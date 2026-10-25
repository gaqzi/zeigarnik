// Whether a thread is new: open, and the human has not yet written to it,
// by a reply or by nesting it. A move by Claude changes nothing. The pane
// marks such threads so the human sees where Claude is waiting.

import type { Node, State } from './evolve.ts'

export const isNew = (node: Node, state: State): boolean =>
  node.status === 'open' &&
  !state.replies.some(
    reply => reply.node === node.id && reply.author === 'human',
  ) &&
  !state.moves.some(move => move.node === node.id && move.source === 'chat')
