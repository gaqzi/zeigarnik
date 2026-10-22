import type { Action, Goal, State } from './evolve.ts'
import { handoff } from './handoff.ts'

// The full view of the session, line by line: the pane draws the lines, and
// `show` sends them to Claude on request (zg-zo2).

export type Line = { text: string; isOpen: boolean }

const GOAL_MARK: Record<Goal['status'], string> = {
  open: '○',
  achieved: '✓',
  failed: '✗',
  cancelled: '✗',
}

const ACTION_MARK: Record<Action['status'], string> = {
  open: '☐',
  done: '✓',
  cancelled: '✗',
  exported: '→',
}

const goalLine = (goal: Goal): Line => {
  const origin = goal.origin === undefined ? '' : ` (${goal.origin})`
  const end =
    goal.status === 'open'
      ? ''
      : ` · ${goal.status}${goal.reason === undefined ? '' : `: ${goal.reason}`}`

  return {
    text: `${GOAL_MARK[goal.status]} ${goal.id} ${goal.text}${origin}${end}`,
    isOpen: goal.status === 'open',
  }
}

const actionLine = (action: Action): Line => {
  const end =
    action.status === 'exported'
      ? ` → ${action.ref}`
      : action.reason === undefined
        ? ''
        : ` · ${action.reason}`

  return {
    text: `${ACTION_MARK[action.status]} ${action.id} ${action.text} (${action.owner})${end}`,
    isOpen: action.status === 'open',
  }
}

export const overview = (state: State): Line[] => {
  if (state.goals.length === 0) return [{ text: 'No goal yet.', isOpen: false }]
  const actions =
    state.actions.length === 0
      ? []
      : [{ text: 'Actions', isOpen: false }, ...state.actions.map(actionLine)]
  const written =
    state.handoff === undefined
      ? []
      : [
          {
            text: state.handoffStands
              ? 'Handoff written: /zg:copy-handoff copies it.'
              : 'Handoff out of date: write it again.',
            isOpen: false,
          },
        ]

  return [...state.goals.map(goalLine), ...actions, ...written]
}

// What `show` answers: the overview, and the handoff when one is written.
export const fullView = (state: State): string => {
  const lines = overview(state).map(line => line.text)
  const written = state.handoff === undefined ? [] : ['', handoff(state)]

  return [...lines, ...written].join('\n')
}
