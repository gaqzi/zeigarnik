import type { State } from './evolve.ts'

// The short view re-injected after a compaction or a resume (zg-zo2): the
// open goal, its open threads and open actions, and where the full view is.
// It stays within the 2k re-injection budget (zg-n27) by cutting long texts
// and long lists.

const MAX_GOAL = 300
const MAX_THREAD = 80
const MAX_ACTION = 120
const MAX_ORIGIN = 40
const MAX_LISTED = 20

const cut = (text: string, max: number) => {
  const line = text.replace(/\s+/g, ' ').trim()

  return line.length <= max ? line : `${line.slice(0, max - 1)}…`
}

const listed = (heading: string, lines: string[]) =>
  lines.length === 0
    ? []
    : [
        heading,
        ...lines.slice(0, MAX_LISTED),
        ...(lines.length > MAX_LISTED
          ? [`- and ${lines.length - MAX_LISTED} more`]
          : []),
      ]

export const brief = (state: State): string | undefined => {
  if (state.goals.length === 0) return undefined
  const goal = state.goals.find(one => one.status === 'open')
  const head =
    goal === undefined
      ? state.handoffStands
        ? 'zg: no goal is open, and the handoff is written.'
        : 'zg: no goal is open.'
      : `zg: the goal is ${goal.id} ${cut(goal.text, MAX_GOAL)}${goal.origin === undefined ? '' : ` (${cut(goal.origin, MAX_ORIGIN)})`}`
  const threads = state.nodes
    .filter(node => node.status === 'open')
    .map(
      node =>
        `- ${node.id} ${cut(node.title, MAX_THREAD)} (under ${node.parent})`,
    )
  const actions = state.actions
    .filter(action => action.status === 'open')
    .map(
      action =>
        `- ${action.id} ${cut(action.text, MAX_ACTION)} (${action.owner})`,
    )

  return [
    head,
    ...listed('Open threads:', threads),
    ...listed('Open actions:', actions),
    'Full view: mcp__zg__show.',
  ].join('\n')
}
