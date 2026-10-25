import type { Action, Node, State } from './evolve.ts'
import {
  actionArrow,
  bySiblingOrder,
  type Line,
  mergedFrom,
  nodeArrow,
  nodeEnd,
  nodeMark,
  replyLines,
} from './overview.ts'

// Everything zg knows about one thread, decision, option or action, line by
// line. Every line is dim once the item is closed, like its row in the pane.

const withArrow = (status: string, arrow: string | undefined): string =>
  arrow === undefined ? status : `${status} ${arrow}`

// What names a thread in a list: its outcome once resolved, else its title.
const outcomeOrTitle = (node: Node): string =>
  node.status === 'resolved' && node.outcome !== undefined
    ? node.outcome
    : node.title

// The nodes under a parent in the pane's sibling order.
const childrenOf = (state: State, parent: string): Node[] =>
  state.nodes.filter(node => node.parent === parent).sort(bySiblingOrder)

const childrenLine = (state: State, parent: string): string[] => {
  const children = childrenOf(state, parent)
  if (children.length === 0) return []

  const described = children.map(
    child => `${child.id} ${nodeMark(child)} ${outcomeOrTitle(child)}`,
  )

  return [`children: ${described.join(', ')}`]
}

const optional = (text: string | undefined): string[] =>
  text === undefined ? [] : [text]

const nodeDetails = (state: State, node: Node): Line[] =>
  [
    `${node.id} ${node.title}`,
    `under ${node.parent}`,
    withArrow(node.status, nodeArrow(node)),
    ...optional(node.reason),
    ...childrenLine(state, node.id),
    ...optional(mergedFrom(state, node.id)),
    ...replyLines(state, node.id, '').map(line => line.text),
  ].map(text => ({ text, isOpen: node.status === 'open' }))

// An option in its decision's details: its replies, then what is under it.
const optionLines = (state: State, option: Node): string[] => {
  const indent = ' '.repeat(9)
  const children = childrenOf(state, option.id).map(
    child => `${indent}${child.id} ${outcomeOrTitle(child)} ${nodeMark(child)}`,
  )

  return [
    `     ${nodeMark(option)} ${option.id} ${option.title}${nodeEnd(option)}`,
    ...replyLines(state, option.id, indent).map(line => line.text),
    ...children,
  ]
}

// Once made: the pick and the words behind it.
const pickLines = (state: State, decision: Node): string[] => {
  const pick = decision.picks?.at(-1)
  const option = state.nodes.find(one => one.id === pick?.option)
  if (pick === undefined || option === undefined) return []

  return [
    `   Decision: ${option.id} ${option.title}`,
    `   because (${pick.source}): ${pick.reason}`,
  ]
}

// Once cancelled: that, and the words behind it.
const cancelLines = (decision: Node): string[] =>
  decision.status !== 'cancelled'
    ? []
    : [
        '   Cancelled',
        ...optional(
          decision.reason === undefined
            ? undefined
            : `   because (${decision.cancelSource}): ${decision.reason}`,
        ),
      ]

const decisionDetails = (state: State, decision: Node): Line[] =>
  [
    `${decision.id} Decision: ${decision.title}`,
    ...pickLines(state, decision),
    ...cancelLines(decision),
    '   Options:',
    ...childrenOf(state, decision.id).flatMap(option =>
      optionLines(state, option),
    ),
  ].map(text => ({ text, isOpen: decision.status === 'open' }))

const actionDetails = (action: Action): Line[] =>
  [
    `${action.id} ${action.text}`,
    `owner: ${action.owner}`,
    withArrow(action.status, actionArrow(action)),
    ...optional(action.reason),
  ].map(text => ({ text, isOpen: action.status === 'open' }))

export const details = (state: State, id: string): Line[] => {
  const node = state.nodes.find(one => one.id === id)
  if (node?.kind === 'decision') return decisionDetails(state, node)
  if (node !== undefined) return nodeDetails(state, node)
  const action = state.actions.find(one => one.id === id)

  return action === undefined ? [] : actionDetails(action)
}
