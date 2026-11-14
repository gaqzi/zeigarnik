import type { Criterion, Node, State } from './evolve.ts'

// Criteria flow down: in force for a node are the criteria on its ancestor
// decisions, itself included when it is a decision, that are open or
// decided. Derived from the log, never stored (zg-ww9).

export const byCriterionNumber = (one: Criterion, other: Criterion): number =>
  Number(one.id.slice(1)) - Number(other.id.slice(1))

// A decision judges its subtree while it is open or decided.
export const judges = (node: Node): boolean =>
  node.kind === 'decision' &&
  (node.status === 'open' || node.status === 'decided')

// A criterion's current text and origin are those of its latest version.
export const currentText = (criterion: Criterion): string =>
  criterion.versions.at(-1)?.text ?? ''

export const originOf = (criterion: Criterion): string | undefined =>
  criterion.versions.at(-1)?.origin

// The criteria on a decision, in ID order, whatever the decision's status.
export const criteriaOn = (state: State, id: string): Criterion[] =>
  state.criteria
    .filter(criterion => criterion.on === id)
    .sort(byCriterionNumber)

// The node and the nodes above it, nearest first; a cycle in the log ends it.
const withAncestors = (state: State, id: string): string[] => {
  const chain: string[] = []
  let at: string | undefined = id
  while (at !== undefined && !chain.includes(at)) {
    chain.push(at)
    const current: string = at
    at = state.nodes.find(node => node.id === current)?.parent
  }

  return chain
}

// Own criteria first, then the inherited, each group in ID order.
export const inForce = (state: State, id: string): Criterion[] => {
  const judging = new Set(
    withAncestors(state, id).filter(one =>
      state.nodes.some(node => node.id === one && judges(node)),
    ),
  )
  const own = judging.has(id) ? criteriaOn(state, id) : []
  const inherited = state.criteria
    .filter(criterion => criterion.on !== id && judging.has(criterion.on))
    .sort(byCriterionNumber)

  return [...own, ...inherited]
}

// Whether an open decision sits anywhere under the node, so would inherit a
// criterion put on it.
export const hasOpenDecisionBelow = (state: State, id: string): boolean =>
  state.nodes.some(
    node =>
      node.id !== id &&
      node.kind === 'decision' &&
      node.status === 'open' &&
      withAncestors(state, node.id).includes(id),
  )
