import type { Command } from './commands.ts'
import type { Event } from './events.ts'
import type { Action, Goal, State } from './evolve.ts'
import { nextId } from './ids.ts'

// The rules live here and nowhere else (zg-kux). A command that would break
// one is refused with the reason and a fix (zg-su8).

export type Refusal = { reason: string; fix: string }

export type Decided = { events: Event[] } | { refusal: Refusal }

const refuse = (reason: string, fix: string): Decided => ({
  refusal: { reason, fix },
})

const goalId = (goals: readonly Goal[]) =>
  goals.length === 0 ? 'G' : `G${goals.length + 1}`

const openGoal = (state: State) =>
  state.goals.find(goal => goal.status === 'open')

const openActions = (state: State) =>
  state.actions.filter(action => action.status === 'open')

const ids = (actions: readonly Action[]) =>
  actions.map(action => action.id).join(', ')

// Commands on an action name one that exists and is still open.
const findOpen = (
  state: State,
  id: string,
): { action: Action } | { refusal: Refusal } => {
  const action = state.actions.find(one => one.id === id)
  const open = openActions(state)
  const pick =
    open.length === 0
      ? 'There are no open actions.'
      : `The open actions are ${ids(open)}.`
  if (action === undefined) {
    return { refusal: { reason: `There is no action ${id}.`, fix: pick } }
  }
  if (action.status !== 'open') {
    return {
      refusal: { reason: `${id} is already ${action.status}.`, fix: pick },
    }
  }

  return { action }
}

const onAction = (
  state: State,
  id: string,
  event: (action: Action) => Event,
): Decided => {
  const found = findOpen(state, id)

  return 'refusal' in found ? found : { events: [event(found.action)] }
}

const ofReason = (reason: string | undefined) =>
  reason === undefined ? {} : { reason }

const decideOpen = (state: State, command: Command & { type: 'OpenGoal' }) => {
  const open = openGoal(state)
  if (open !== undefined) {
    return refuse(
      `One open goal: ${open.id} is still open.`,
      `Ask the human whether ${open.id} is achieved, failed or cancelled, and close it first; or keep working on ${open.id}.`,
    )
  }

  return {
    events: [
      {
        type: 'GoalOpened',
        at: command.at,
        goal: goalId(state.goals),
        text: command.text,
        ...(command.origin === undefined ? {} : { origin: command.origin }),
      } satisfies Event,
    ],
  }
}

const decideAdd = (state: State, command: Command & { type: 'AddAction' }) => {
  if (openGoal(state) === undefined) {
    return refuse(
      'One parent: an action belongs to the open goal, and no goal is open.',
      'Open a goal first: the human starts one with /zg:open.',
    )
  }

  return {
    events: [
      {
        type: 'ActionAdded',
        at: command.at,
        action: nextId(
          'A',
          state.actions.map(action => action.id),
        ),
        text: command.text,
        owner: command.owner,
        ...(command.quote === undefined ? {} : { quote: command.quote }),
      } satisfies Event,
    ],
  }
}

const decideCloseGoal = (
  state: State,
  command: Command & { type: 'CloseGoal' },
): Decided => {
  const goal = openGoal(state)
  if (goal === undefined) {
    return refuse(
      'No goal is open.',
      'Nothing to close: write the handoff, or the human opens a goal with /zg:open.',
    )
  }
  const { at, source, reason } = command
  switch (command.as) {
    case 'achieved':
      return {
        events: [
          {
            type: 'GoalAchieved',
            at,
            goal: goal.id,
            source,
            ...ofReason(reason),
          },
        ],
      }
    case 'failed':
      if (reason === undefined || reason.trim() === '') {
        return refuse(
          `Closing says how: a failed goal needs the reason it can't be done.`,
          `Ask the human why ${goal.id} failed, and pass it as the reason.`,
        )
      }
      return {
        events: [{ type: 'GoalFailed', at, goal: goal.id, source, reason }],
      }
    case 'cancelled':
      return {
        events: [
          {
            type: 'GoalCancelled',
            at,
            goal: goal.id,
            source,
            ...ofReason(reason),
          },
        ],
      }
  }
}

const decideHandoff = (
  state: State,
  command: Command & { type: 'WriteHandoff' },
): Decided => {
  const goal = openGoal(state)
  const actions = openActions(state)
  const open = [
    ...(goal === undefined ? [] : [goal.id]),
    ...actions.map(a => a.id),
  ]
  if (open.length > 0) {
    return refuse(
      `Close only when nothing is open: ${open.join(', ')} still open.`,
      'Ask the human how each one ends: the goal achieved, failed or cancelled; each action done, cancelled, or exported to the handoff for filing.',
    )
  }
  const { at, next, decisions, references } = command

  return {
    events: [{ type: 'HandoffWritten', at, next, decisions, references }],
  }
}

const decideCloseSession = (
  state: State,
  command: Command & { type: 'CloseSession' },
): Decided => {
  if (!state.handoffStands) {
    return refuse(
      'Close only when nothing is open: the session closes after its handoff is written, and none stands.',
      'Run /zg:close in the session to close the goal and write the handoff.',
    )
  }

  return {
    events: [{ type: 'SessionClosed', at: command.at, via: command.via }],
  }
}

export const decide = (state: State, command: Command): Decided => {
  if (state.isClosed) {
    return refuse(
      'This session is closed: its handoff was written and it was cleared.',
      'Start a new session, and open its goal with /zg:open.',
    )
  }
  const { at } = command
  switch (command.type) {
    case 'OpenGoal':
      return decideOpen(state, command)
    case 'AddAction':
      return decideAdd(state, command)
    case 'CompleteAction':
      return onAction(state, command.action, action => ({
        type: 'ActionDone',
        at,
        action: action.id,
        source: command.source,
        ...ofReason(command.reason),
      }))
    case 'CancelAction':
      return onAction(state, command.action, action => ({
        type: 'ActionCancelled',
        at,
        action: action.id,
        source: command.source,
        ...ofReason(command.reason),
      }))
    case 'ExportAction':
      if (command.ref.trim() === '') {
        return refuse(
          'Exports keep their reference: the export has none.',
          `Pass where ${command.action} went (a bead ID, ticket key or path), or "handoff" to list it for the human to file.`,
        )
      }
      return onAction(state, command.action, action => ({
        type: 'ActionExported',
        at,
        action: action.id,
        ref: command.ref,
        source: command.source,
        ...ofReason(command.reason),
      }))
    case 'CloseGoal':
      return decideCloseGoal(state, command)
    case 'WriteHandoff':
      return decideHandoff(state, command)
    case 'CloseSession':
      return decideCloseSession(state, command)
  }
}
