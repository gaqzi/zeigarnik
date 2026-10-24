// Whether a thread is new: open, and the human has not yet replied on it.
// The pane marks such threads so the human sees where Claude is waiting.

import type { Node, Reply } from './evolve.ts'

export const isNew = (node: Node, replies: readonly Reply[]): boolean =>
  node.status === 'open' &&
  !replies.some(reply => reply.node === node.id && reply.author === 'human')
