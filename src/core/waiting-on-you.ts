// The open threads waiting on the human: those whose latest reply is Claude's
// (zg-w93). Derived from the log each time, nothing stored (zg-ww9).

import type { State } from './evolve.ts'
import { repliesOn } from './replies-on.ts'

const idNumber = (id: string): number => Number(id.slice(1))

export const waitingOnYou = (state: State): string[] =>
  state.nodes
    .filter(
      node =>
        node.kind === 'thread' &&
        node.status === 'open' &&
        repliesOn(state, node.id).at(-1)?.reply.author === 'claude',
    )
    .map(node => node.id)
    .sort((one, other) => idNumber(one) - idNumber(other))
