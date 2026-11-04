import { details } from './details.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'
import { fullView } from './overview.ts'
import { since } from './since.ts'

// A prompt that is only a thread, decision or option ID, or G for the goal,
// asks for a recap.
const ID_ONLY = /^(?:[TD]\d+(?:\.\d+)?|G)$/i

const GOAL = 'G'

const goalRecap = (events: Event[]): string => {
  const state = fold(events)
  const open = state.goals.some(
    goal => goal.id === GOAL && goal.status === 'open',
  )
  const body = open ? fullView(state) : ''

  return body === '' ? `There is no item ${GOAL}.` : `Recap ${GOAL}\n${body}`
}

const nodeRecap = (events: Event[], id: string): string => {
  const body = details(fold(events), id)
    .map(line => line.text)
    .join('\n')

  return body === ''
    ? `There is no item ${id}.`
    : `Recap ${id}\n${since(events, id)}\n${body}`
}

const recapOf = (events: Event[], id: string): string =>
  id === GOAL ? goalRecap(events) : nodeRecap(events, id)

export const recap = (events: Event[], prompt: string): string | undefined => {
  const trimmed = prompt.trim()

  return ID_ONLY.test(trimmed)
    ? recapOf(events, trimmed.toUpperCase())
    : undefined
}
