import type { Event } from './events.ts'
import { fold, type State } from './evolve.ts'
import { inForce } from './in-force.ts'

// What changed on a node since the human last wrote on it, or since it
// opened when they never did. Derived from the log, never stored (zg-ww9).

// A node's children, and for a decision the children of its options; no deeper.
const isBelow = (state: State, id: string, node: string): boolean => {
  const parent = state.nodes.find(one => one.id === node)?.parent
  if (parent === undefined) return false
  if (parent === id) return true
  const grand = state.nodes.find(one => one.id === parent)

  return grand?.kind === 'option' && grand.parent === id
}

const changeOf = (state: State, id: string, event: Event): string[] => {
  const below = (node: string) => isBelow(state, id, node)
  const inForceOn = (criterion: string) =>
    inForce(state, id).some(one => one.id === criterion)
  switch (event.type) {
    case 'ThreadResolved':
      return below(event.thread)
        ? [`${event.thread} resolved → ${event.outcome}`]
        : []
    case 'NodeCancelled':
      return below(event.node)
        ? [`${event.node} cancelled → ${event.reason}`]
        : []
    case 'NodeMerged':
      return event.from
        .filter(below)
        .map(from => `${from} merged into ${event.into}`)
    case 'DecisionMade': {
      if (!below(event.decision)) return []
      const title =
        state.nodes.find(node => node.id === event.option)?.title ?? ''

      return [`${event.decision} decided → ${event.option} ${title}`]
    }
    case 'CriterionAdded': {
      if (!inForceOn(event.criterion)) return []
      const origin = event.origin === undefined ? '' : ` (from ${event.origin})`

      return [`${event.criterion} ${event.text} added${origin}`]
    }
    case 'CriterionRevised': {
      const criterion = state.criteria.find(one => one.id === event.criterion)
      if (criterion === undefined || !inForceOn(criterion.id)) return []

      return [`${event.criterion} revised → ${event.text}`]
    }
    default:
      return []
  }
}

const opens = (event: Event, id: string): boolean =>
  (event.type === 'ThreadOpened' && event.thread === id) ||
  (event.type === 'DecisionOpened' && event.decision === id) ||
  (event.type === 'OptionAdded' && event.option === id)

// Where the window starts: after the human's latest reply on the node, else
// after the node opened. Replies are read folded, so a moved reply counts
// where it now stands.
const anchorOf = (events: Event[], state: State, id: string): number => {
  const reply = state.replies.findLast(
    one => one.author === 'human' && one.node === id,
  )
  if (reply !== undefined)
    return events.findLastIndex(
      event =>
        event.type === 'NodeReplied' &&
        event.at === reply.at &&
        event.author === reply.author &&
        event.text === reply.text,
    )

  return events.findIndex(event => opens(event, id))
}

export const since = (events: Event[], id: string): string => {
  const state = fold(events)
  const anchor = anchorOf(events, state, id)
  const wrote = state.replies.some(
    one => one.author === 'human' && one.node === id,
  )
  const changes = events
    .slice(anchor + 1)
    .flatMap(event => changeOf(state, id, event))

  const label = wrote ? `you last wrote on ${id}` : `${id} opened`
  if (changes.length === 0)
    return wrote
      ? `Nothing has changed on ${id} since you last wrote on it.`
      : `Nothing has changed on ${id} since it opened.`

  return `Since ${label}: ${changes.join(' · ')}`
}
