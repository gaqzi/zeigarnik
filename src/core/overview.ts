import type { Action, Goal, Node, State } from './evolve.ts'
import { criteriaOn, currentText } from './in-force.ts'
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
  decided: '✓',
  chosen: '✓',
  'not chosen': '·',
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

// What the pane folds: a closed decision's options go into its line.
const collapsesChildren = (node: Node): boolean =>
  node.kind === 'decision' && node.status !== 'open'

const collapsesNothing = () => false

// The nodes under a parent, children after their parent, siblings threads
// first, then decisions, numeric within a kind. Nothing is listed under a
// node for which `folds` is true.
const nodesUnder = (
  state: State,
  parent: string,
  folds: (node: Node) => boolean,
  depth = 1,
): Placed[] =>
  state.nodes
    .filter(node => node.parent === parent)
    .sort(bySiblingOrder)
    .flatMap(node => [
      { node, depth },
      ...(folds(node) ? [] : nodesUnder(state, node.id, folds, depth + 1)),
    ])

// The nodes under one goal, as the pane draws them.
export const nodesInGoal = (state: State, goal: Goal): Node[] =>
  nodesUnder(state, goal.id, collapsesNothing).map(placed => placed.node)

// Every node as the pane draws them, goal by goal.
export const nodesInTreeOrder = (state: State): Node[] =>
  state.goals.flatMap(goal => nodesInGoal(state, goal))

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
    : node.status !== 'cancelled'
      ? ''
      : node.reason !== undefined
        ? ` · ${node.reason}`
        : node.kind === 'option'
          ? ` · with ${node.parent}`
          : ''
}

// The option a decision's latest pick chose, if it is still there.
export const pickedOption = (state: State, decision: Node): Node | undefined =>
  state.nodes.find(one => one.id === decision.picks?.at(-1)?.option)

// A decided decision names its latest pick.
const decisionEnd = (state: State, node: Node): string => {
  const option = pickedOption(state, node)

  return option === undefined ? '' : ` → ${option.id} ${option.title}`
}

// A node as the pane words it: mark, id, title, and how it ended.
export const nodeText = (state: State, node: Node, mark: string): string => {
  const end =
    node.status === 'decided' ? decisionEnd(state, node) : nodeEnd(node)

  return `${mark} ${node.id} ${node.title}${end}`
}

const nodeLine = (
  state: State,
  { node, depth }: Placed,
  mark: string,
): Line => {
  return {
    text: `${'  '.repeat(depth)}${nodeText(state, node, mark)}`,
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

// A decision's criteria, one per line before its options, two spaces deeper.
const criteriaLines = (state: State, { node, depth }: Placed): Line[] =>
  criteriaOn(state, node.id).map(criterion => ({
    text: `${'  '.repeat(depth + 2)}${criterion.id} ${currentText(criterion)}`,
    isOpen: node.status === 'open',
    item: criterion.id,
  }))

// The count always covers every node; `folds` only shortens what is drawn.
const view = (
  state: State,
  folds: (node: Node) => boolean,
  linesOf: (one: Placed) => Line[],
): Line[] => {
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
    const placed = nodesUnder(state, goal.id, collapsesNothing)
    const drawn = nodesUnder(state, goal.id, folds)

    return [goalLine(goal), countLine(placed, goal), ...drawn.flatMap(linesOf)]
  })

  return [...goals, ...actions, ...written]
}

// The pane lines: threads without what was said on them.
export const overview = (state: State): Line[] =>
  view(state, collapsesChildren, one => [
    nodeLine(state, one, paneMark(one.node, state)),
    ...(collapsesChildren(one.node) ? [] : criteriaLines(state, one)),
  ])

// What `show` answers: the overview with each thread's replies, and the
// handoff when one is written.
export const fullView = (state: State): string => {
  const lines = view(state, collapsesNothing, one => [
    nodeLine(state, one, nodeMark(one.node)),
    ...criteriaLines(state, one),
    ...mergedFromLines(state, one),
    ...replyLines(state, one.node.id, '  '.repeat(one.depth + 1)),
  ]).map(line => line.text)
  const written = state.handoff === undefined ? [] : ['', handoff(state)]

  return [...lines, ...written].join('\n')
}
