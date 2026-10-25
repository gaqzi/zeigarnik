import type { Action, Node, State } from './evolve.ts'
import {
  actionArrow,
  type Line,
  mergedFrom,
  NODE_MARK,
  nodeArrow,
  replyLines,
} from './overview.ts'

// Everything zg knows about one thread or action, line by line. Every line is
// dim once the item is closed, like its row in the pane.

const withArrow = (status: string, arrow: string | undefined): string =>
  arrow === undefined ? status : `${status} ${arrow}`

// What names a thread in a list: its outcome once resolved, else its title.
const outcomeOrTitle = (node: Node): string =>
  node.status === 'resolved' && node.outcome !== undefined
    ? node.outcome
    : node.title

const childrenLine = (state: State, parent: string): string[] => {
  const children = state.nodes.filter(node => node.parent === parent)
  if (children.length === 0) return []

  const described = children.map(
    child => `${child.id} ${NODE_MARK[child.status]} ${outcomeOrTitle(child)}`,
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

const actionDetails = (action: Action): Line[] =>
  [
    `${action.id} ${action.text}`,
    `owner: ${action.owner}`,
    withArrow(action.status, actionArrow(action)),
    ...optional(action.reason),
  ].map(text => ({ text, isOpen: action.status === 'open' }))

export const details = (state: State, id: string): Line[] => {
  const node = state.nodes.find(one => one.id === id)
  if (node !== undefined) return nodeDetails(state, node)
  const action = state.actions.find(one => one.id === id)

  return action === undefined ? [] : actionDetails(action)
}
