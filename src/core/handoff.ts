import { HANDOFF } from './events.ts'
import type { State } from './evolve.ts'

// The handoff: the next goal, the decisions to respect and the references,
// plus what the human files by hand while the default sink is the handoff
// (zg-2x6). Empty when none is written.

const list = (title: string, items: readonly string[]) =>
  items.length === 0 ? [] : [`${title}:`, ...items.map(item => `  - ${item}`)]

export const handoff = (state: State): string => {
  if (state.handoff === undefined) return ''
  const { next, decisions, references } = state.handoff
  const toFile = [
    ...state.actions
      .filter(action => action.status === 'exported' && action.ref === HANDOFF)
      .map(action => `Action: ${action.text}`),
    ...decisions
      .filter(decision => decision.lasting)
      .map(decision => `Decision: ${decision.text}`),
  ]

  return [
    `Goal: ${next}`,
    ...list(
      'Decisions to respect',
      decisions.map(decision => decision.text),
    ),
    ...list('References', references),
    ...list('To file by hand', toFile),
  ].join('\n')
}
