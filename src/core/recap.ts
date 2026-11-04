import { details } from './details.ts'
import type { State } from './evolve.ts'
import { fullView } from './overview.ts'

// A prompt that is only a thread, decision or option ID, or G for the goal,
// asks for a recap.
const ID_ONLY = /^(?:[TD]\d+(?:\.\d+)?|G)$/i

const GOAL = 'G'

const recapOf = (state: State, id: string): string => {
  const body =
    id === GOAL
      ? state.goals.some(goal => goal.id === GOAL && goal.status === 'open')
        ? fullView(state)
        : undefined
      : details(state, id)
          .map(line => line.text)
          .join('\n')

  return body === undefined || body === ''
    ? `There is no item ${id}.`
    : `Recap ${id}\n${body}`
}

export const recap = (state: State, prompt: string): string | undefined => {
  const trimmed = prompt.trim()

  return ID_ONLY.test(trimmed)
    ? recapOf(state, trimmed.toUpperCase())
    : undefined
}
