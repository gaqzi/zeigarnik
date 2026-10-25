import type { Node } from './evolve.ts'

// Containment: which kind of item may sit under which. One table, read by
// decide when something opens, nests or merges (README, Rules: one parent).

export type Holder = 'goal' | Node['kind']

const HOLDS: Record<Holder, readonly Node['kind'][]> = {
  goal: ['thread', 'decision'],
  thread: ['thread', 'decision'],
  decision: ['option'],
  option: ['thread', 'decision'],
}

export const holds = (parent: Holder, child: Node['kind']): boolean =>
  HOLDS[parent].includes(child)
