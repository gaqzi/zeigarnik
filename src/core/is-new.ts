// Whether a node is new: open, and the human has not yet written to it,
// by a reply, by nesting it or by merging threads into it. A move or merge
// by Claude changes nothing. A decision is also written to by a reply on one
// of its options. The pane marks such nodes so the human sees where Claude
// is waiting.

import type { Node, State } from './evolve.ts'

const hasHumanReply = (state: State, id: string): boolean =>
  state.replies.some(reply => reply.node === id && reply.author === 'human')

const hasHumanReplyOnOption = (state: State, decision: string): boolean =>
  state.nodes.some(
    node =>
      node.kind === 'option' &&
      node.parent === decision &&
      hasHumanReply(state, node.id),
  )

export const isNew = (node: Node, state: State): boolean =>
  node.status === 'open' &&
  !hasHumanReply(state, node.id) &&
  !(node.kind === 'decision' && hasHumanReplyOnOption(state, node.id)) &&
  !state.moves.some(move => move.node === node.id && move.source === 'chat') &&
  !state.merges.some(
    merge => merge.into === node.id && merge.source !== 'claude',
  )
