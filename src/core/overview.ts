import type { Action, Goal, Node, State } from './evolve.ts'
import { handoff } from './handoff.ts'
import { isNew } from './is-new.ts'
import { repliesOn } from './replies-on.ts'

// The full view of the session, line by line: `show` sends Claude all of it
// on request, and the pane draws a subset (zg-zo2), except that the pane also
// marks a new thread ✦, which `show` does not.

// `item` is the node or action a pane row draws, which can be selected.
export type Line = { text: string; isOpen: boolean; item?: string }

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

const CLOSED_MARK: Record<Exclude<Node['status'], 'open'>, string> = {
  resolved: '✓',
  cancelled: '✗',
  merged: '→',
}

const OPEN_MARK: Record<Node['kind'], string> = {
  thread: '○',
  decision: '◆',
  option: '◇',
}

export const nodeMark = (node: Node): string =>
  node.status === 'open' ? OPEN_MARK[node.kind] : CLOSED_MARK[node.status]

const paneMark = (node: Node, state: State): string =>
  isNew(node, state) ? '✦' : nodeMark(node)

type Placed = { node: Node; depth: number }

const KIND_ORDER: Record<Node['kind'], number> = {
  thread: 0,
  decision: 1,
  option: 2,
}

// An ID's numbers, compared one by one, so D1.10 follows D1.9.
const idNumbers = (id: string): number[] => id.slice(1).split('.').map(Number)

export const bySiblingOrder = (one: Node, other: Node): number => {
  const kinds = KIND_ORDER[one.kind] - KIND_ORDER[other.kind]
  if (kinds !== 0) return kinds
  const [x, y] = [idNumbers(one.id), idNumbers(other.id)]

  return (x[0] ?? 0) - (y[0] ?? 0) || (x[1] ?? 0) - (y[1] ?? 0)
}

// The nodes under a parent, children after their parent, siblings threads
// first, then decisions, numeric within a kind.
const nodesUnder = (state: State, parent: string, depth = 1): Placed[] =>
  state.nodes
    .filter(node => node.parent === parent)
    .sort(bySiblingOrder)
    .flatMap(node => [
      { node, depth },
      ...nodesUnder(state, node.id, depth + 1),
    ])

// Every node as the pane draws them, goal by goal.
export const nodesInTreeOrder = (state: State): Node[] =>
  state.goals.flatMap(goal =>
    nodesUnder(state, goal.id).map(placed => placed.node),
  )

// Where a closed thread went: its outcome, or the thread it merged into.
export const nodeArrow = (node: Node): string | undefined =>
  node.status === 'resolved' && node.outcome !== undefined
    ? `→ ${node.outcome}`
    : node.status === 'merged'
      ? `→ ${node.into}`
      : undefined

export const actionArrow = (action: Action): string | undefined =>
  action.status === 'exported' ? `→ ${action.ref}` : undefined

// How a closed node ended, after its title: where it went, or why it was
// cancelled.
export const nodeEnd = (node: Node): string => {
  const arrow = nodeArrow(node)

  return arrow !== undefined
    ? ` ${arrow}`
    : node.status === 'cancelled' && node.reason !== undefined
      ? ` · ${node.reason}`
      : ''
}

const nodeLine = ({ node, depth }: Placed, mark: string): Line => {
  return {
    text: `${'  '.repeat(depth)}${mark} ${node.id} ${node.title}${nodeEnd(node)}`,
    isOpen: node.status === 'open',
    item: node.id,
  }
}

const countLine = (placed: readonly Placed[], goal: Goal): Line => {
  const open = placed.filter(one => one.node.status === 'open').length

  return {
    text: `${open} open · ${placed.length - open} closed`,
    isOpen: goal.status === 'open',
  }
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
  const arrow = actionArrow(action)
  const end =
    (arrow === undefined ? '' : ` ${arrow}`) +
    (action.reason === undefined ? '' : ` · ${action.reason}`)

  return {
    text: `${ACTION_MARK[action.status]} ${action.id} ${action.text} (${action.owner})${end}`,
    isOpen: action.status === 'open',
    item: action.id,
  }
}

// A thread's replies, numbered from 1 in log order, each line starting with
// `indent`; a reply's later lines sit under its text.
export const replyLines = (
  state: State,
  node: string,
  indent: string,
): Line[] =>
  repliesOn(state, node).map(({ ordinal, reply }) => {
    const prefix = `${indent}#${ordinal} ${reply.author}: `
    const under = ' '.repeat(prefix.length)

    return {
      text: prefix + reply.text.replaceAll('\n', `\n${under}`),
      isOpen: false,
    }
  })

// What was merged into a thread, in the order merged: "merged from T4, T6".
export const mergedFrom = (state: State, node: string): string | undefined => {
  const from = state.merges
    .filter(merge => merge.into === node)
    .flatMap(merge => merge.from)

  return from.length === 0 ? undefined : `merged from ${from.join(', ')}`
}

const mergedFromLines = (state: State, { node, depth }: Placed): Line[] => {
  const text = mergedFrom(state, node.id)

  return text === undefined
    ? []
    : [{ text: `${'  '.repeat(depth + 1)}${text}`, isOpen: false }]
}

const view = (state: State, linesOf: (one: Placed) => Line[]): Line[] => {
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

  const goals = state.goals.flatMap(goal => {
    const placed = nodesUnder(state, goal.id)

    return [goalLine(goal), countLine(placed, goal), ...placed.flatMap(linesOf)]
  })

  return [...goals, ...actions, ...written]
}

// The pane lines: threads without what was said on them.
export const overview = (state: State): Line[] =>
  view(state, one => [nodeLine(one, paneMark(one.node, state))])

// What `show` answers: the overview with each thread's replies, and the
// handoff when one is written.
export const fullView = (state: State): string => {
  const lines = view(state, one => [
    nodeLine(one, nodeMark(one.node)),
    ...mergedFromLines(state, one),
    ...replyLines(state, one.node.id, '  '.repeat(one.depth + 1)),
  ]).map(line => line.text)
  const written = state.handoff === undefined ? [] : ['', handoff(state)]

  return [...lines, ...written].join('\n')
}
