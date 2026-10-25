// A thread's replies in show's order, numbered from 1: the numbers show lists
// and a command names.

import type { Reply, State } from './evolve.ts'

export type NumberedReply = { ordinal: number; reply: Reply }

export const repliesOn = (state: State, node: string): NumberedReply[] =>
  state.replies
    .filter(reply => reply.node === node)
    .map((reply, index) => ({ ordinal: index + 1, reply }))
