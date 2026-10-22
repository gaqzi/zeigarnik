import type { State } from './evolve.ts'

// The short view re-injected after a compaction or a resume (zg-zo2): the
// open goal and its open actions, and where the full view is. It stays within
// the 2k re-injection budget (zg-n27) by cutting long texts and long lists.

const MAX_TEXT = 300
const MAX_ACTIONS = 20

const cut = (text: string) =>
  text.length <= MAX_TEXT ? text : `${text.slice(0, MAX_TEXT - 1)}…`

export const brief = (state: State): string | undefined => {
  if (state.goals.length === 0) return undefined
  const goal = state.goals.find(one => one.status === 'open')
  const head =
    goal === undefined
      ? state.handoffStands
        ? 'zg: no goal is open, and the handoff is written.'
        : 'zg: no goal is open.'
      : `zg: the goal is ${goal.id} ${cut(goal.text)}${goal.origin === undefined ? '' : ` (${goal.origin})`}`
  const open = state.actions.filter(action => action.status === 'open')
  const shown = open
    .slice(0, MAX_ACTIONS)
    .map(action => `- ${action.id} ${cut(action.text)} (${action.owner})`)
  const more =
    open.length > MAX_ACTIONS ? [`- and ${open.length - MAX_ACTIONS} more`] : []
  const actions = open.length === 0 ? [] : ['Open actions:', ...shown, ...more]

  return [head, ...actions, 'Full view: mcp__zg__show.'].join('\n')
}
