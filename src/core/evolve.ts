import type { Decision, Event, Owner } from './events.ts'

// The session as the events leave it: a fold, with no rules of its own.

export type Goal = {
  id: string
  text: string
  origin?: string
  status: 'open' | 'achieved' | 'failed' | 'cancelled'
  reason?: string
}

export type Action = {
  id: string
  text: string
  owner: Owner
  status: 'open' | 'done' | 'cancelled' | 'exported'
  reason?: string
  ref?: string
}

export type Handoff = {
  next: string
  decisions: Decision[]
  references: string[]
}

export type State = {
  goals: Goal[]
  actions: Action[]
  handoff?: Handoff
  // False once anything happens after the handoff was written: it no longer
  // describes the session, and has to be written again.
  handoffStands: boolean
  isClosed: boolean
}

export const initial: State = {
  goals: [],
  actions: [],
  handoffStands: false,
  isClosed: false,
}

const setGoal = (state: State, id: string, change: Partial<Goal>): State => ({
  ...state,
  goals: state.goals.map(goal =>
    goal.id === id ? { ...goal, ...change } : goal,
  ),
})

const setAction = (
  state: State,
  id: string,
  change: Partial<Action>,
): State => ({
  ...state,
  actions: state.actions.map(action =>
    action.id === id ? { ...action, ...change } : action,
  ),
})

const ofReason = (reason: string | undefined) =>
  reason === undefined ? {} : { reason }

const happened = (state: State, event: Event): State => {
  switch (event.type) {
    case 'GoalOpened':
      return {
        ...state,
        goals: [
          ...state.goals,
          {
            id: event.goal,
            text: event.text,
            status: 'open',
            ...(event.origin === undefined ? {} : { origin: event.origin }),
          },
        ],
      }
    case 'ActionAdded':
      return {
        ...state,
        actions: [
          ...state.actions,
          {
            id: event.action,
            text: event.text,
            owner: event.owner,
            status: 'open',
          },
        ],
      }
    case 'ActionDone':
      return setAction(state, event.action, { status: 'done' })
    case 'ActionCancelled':
      return setAction(state, event.action, {
        status: 'cancelled',
        ...ofReason(event.reason),
      })
    case 'ActionExported':
      return setAction(state, event.action, {
        status: 'exported',
        ref: event.ref,
      })
    case 'GoalAchieved':
      return setGoal(state, event.goal, { status: 'achieved' })
    case 'GoalFailed':
      return setGoal(state, event.goal, {
        status: 'failed',
        reason: event.reason,
      })
    case 'GoalCancelled':
      return setGoal(state, event.goal, {
        status: 'cancelled',
        ...ofReason(event.reason),
      })
    case 'HandoffWritten':
      return {
        ...state,
        handoff: {
          next: event.next,
          decisions: event.decisions,
          references: event.references,
        },
        handoffStands: true,
      }
    case 'SessionClosed':
      return { ...state, isClosed: true }
    default:
      // An event this build doesn't know changes nothing it can show.
      return state
  }
}

export const evolve = (state: State, event: Event): State =>
  happened(
    event.type === 'HandoffWritten' || event.type === 'SessionClosed'
      ? state
      : { ...state, handoffStands: false },
    event,
  )

export const fold = (events: readonly Event[]): State =>
  events.reduce(evolve, initial)
