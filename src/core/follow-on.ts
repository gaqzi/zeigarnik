// The lines a settling tool's result adds once a node closes: what is still
// open under its parent, or that nothing is and the human can be asked.

import { openChildrenOf } from './decide.ts'
import type { Event } from './events.ts'
import type { State } from './evolve.ts'
import { stillOpenUnder } from './still-open.ts'

// The after-state holds every pick, so more than one means an earlier pick
// had already closed the decision.
const decidedBefore = (state: State, decisionId: string): boolean =>
  (state.nodes.find(node => node.id === decisionId)?.picks?.length ?? 0) > 1

const closedBy = (state: State, event: Event): string[] => {
  switch (event.type) {
    case 'ThreadResolved':
      return [event.thread]
    case 'NodeCancelled':
      return [event.node]
    case 'NodeMerged':
      return event.from
    case 'DecisionMade':
      return decidedBefore(state, event.decision) ? [] : [event.decision]
    default:
      return []
  }
}

const lineFor = (state: State, parentId: string): string | undefined => {
  const parent = state.nodes.find(node => node.id === parentId)
  if (parent === undefined || parent.status !== 'open') return undefined

  const open = openChildrenOf(state, parentId)
  if (parent.kind === 'thread') {
    return open.length > 0
      ? stillOpenUnder(open, parentId)
      : `Nothing is open under ${parentId} now: ask the human whether ${parentId} can close.`
  }
  if (parent.kind !== 'option') return undefined

  const anyOptionOpen = state.nodes
    .filter(node => node.kind === 'option' && node.parent === parent.parent)
    .some(option => openChildrenOf(state, option.id).length > 0)

  return anyOptionOpen
    ? undefined
    : `Nothing is open under ${parent.parent}'s options now: ask the human for ${parent.parent}'s pick.`
}

export const followOn = (state: State, events: readonly Event[]): string[] => {
  const parents = events
    .flatMap(event => closedBy(state, event))
    .map(id => state.nodes.find(node => node.id === id)?.parent)
    .filter((parent): parent is string => parent !== undefined)
  const lines = [...new Set(parents)].map(parent => lineFor(state, parent))

  return lines.filter((line): line is string => line !== undefined)
}
