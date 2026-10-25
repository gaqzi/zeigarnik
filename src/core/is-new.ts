// Whether a thread is new: open, and the human has not yet written to it,
// by a reply, by nesting it or by merging threads into it. A move or merge
// by Claude changes nothing. The pane
// marks such threads so the human sees where Claude is waiting.

import type { Node, State } from './evolve.ts'

export const isNew = (node: Node, state: State): boolean =>
  node.status === 'open' &&
  !state.replies.some(
    reply => reply.node === node.id && reply.author === 'human',
  ) &&
  !state.moves.some(move => move.node === node.id && move.source === 'chat') &&
  !state.merges.some(
    merge => merge.into === node.id && merge.source !== 'claude',
  )
