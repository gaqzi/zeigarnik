import type { Action, Criterion, Node, State } from './evolve.ts'
import { criteriaOn, currentText, inForce, originOf } from './in-force.ts'
import {
  actionArrow,
  bySiblingOrder,
  type Line,
  mergedFrom,
  nodeArrow,
  nodeMark,
  nodeText,
  pickedOption,
  replyLines,
} from './overview.ts'

// Everything zg knows about one thread, decision, option or action, line by
// line. Every line is dim once the item is closed, like its row in the pane.

const withArrow = (status: string, arrow: string | undefined): string =>
  arrow === undefined ? status : `${status} ${arrow}`

// The nodes under a parent in the pane's sibling order.
const childrenOf = (state: State, parent: string): Node[] =>
  state.nodes.filter(node => node.parent === parent).sort(bySiblingOrder)

const childrenLine = (state: State, parent: string): string[] => {
  const children = childrenOf(state, parent)
  if (children.length === 0) return []

  const described = children.map(child =>
    nodeText(state, child, nodeMark(child)),
  )

  return [`children: ${described.join(', ')}`]
}

const optional = (text: string | undefined): string[] =>
  text === undefined ? [] : [text]

// A criterion on the decision being shown: "C5 transfer ≤ 30 min (from D2)".
const ownCriterion = (criterion: Criterion): string => {
  const origin = originOf(criterion)

  return `${criterion.id} ${currentText(criterion)}${origin === undefined ? '' : ` (from ${origin})`}`
}

// A criterion from a decision above: "C4 transfer ≤ 30 min (D1, from D2)".
const inheritedCriterion = (criterion: Criterion): string => {
  const origin = originOf(criterion)

  return `${criterion.id} ${currentText(criterion)} (${criterion.on}${origin === undefined ? '' : `, from ${origin}`})`
}

// What a node is judged on from the decisions above it, for any node.
const inheritedCriteria = (state: State, id: string): string[] =>
  inForce(state, id)
    .filter(criterion => criterion.on !== id)
    .map(inheritedCriterion)

const CRITERIA_LABEL = '   Criteria: '

// A decision's own criteria, even once it is closed, then the inherited ones
// on a line of their own, aligned under the first.
const decisionCriteriaLines = (state: State, decision: Node): string[] => {
  const own = criteriaOn(state, decision.id).map(ownCriterion)
  const inherited = inheritedCriteria(state, decision.id)
  const lines = [own, inherited]
    .filter(group => group.length > 0)
    .map(group => group.join(' · '))

  return lines.map((line, index) =>
    index === 0
      ? `${CRITERIA_LABEL}${line}`
      : `${' '.repeat(CRITERIA_LABEL.length)}${line}`,
  )
}

const criteriaInForceLines = (state: State, id: string): string[] => {
  const inherited = inheritedCriteria(state, id)

  return inherited.length === 0
    ? []
    : [`Criteria in force: ${inherited.join(' · ')}`]
}

const nodeDetails = (state: State, node: Node): Line[] =>
  [
    `${node.id} ${node.title}`,
    `under ${node.parent}`,
    withArrow(node.status, nodeArrow(node)),
    ...optional(node.reason),
    ...criteriaInForceLines(state, node.id),
    ...childrenLine(state, node.id),
    ...optional(mergedFrom(state, node.id)),
    ...replyLines(state, node.id, '').map(line => line.text),
  ].map(text => ({ text, isOpen: node.status === 'open' }))

// An option in its decision's details: its replies, then what is under it.
const optionLines = (state: State, option: Node): string[] => {
  const indent = ' '.repeat(9)
  const children = childrenOf(state, option.id).map(
    child => `${indent}${nodeText(state, child, nodeMark(child))}`,
  )

  return [
    `     ${nodeText(state, option, nodeMark(option))}`,
    ...replyLines(state, option.id, indent).map(line => line.text),
    ...children,
  ]
}

// Once made: the latest pick and its words.
const pickLines = (state: State, decision: Node): string[] => {
  const pick = decision.picks?.at(-1)
  const option = pickedOption(state, decision)
  if (pick === undefined || option === undefined) return []

  return [
    `   Decision: ${option.id} ${option.title}`,
    `   because (${pick.source}): ${pick.reason}`,
  ]
}

// Once decided again: the earlier picks and their words, newest first.
const earlierPickLines = (state: State, decision: Node): string[] =>
  (decision.picks ?? [])
    .slice(0, -1)
    .reverse()
    .flatMap(past => {
      const was = state.nodes.find(one => one.id === past.option)

      return was === undefined
        ? []
        : [
            `   earlier: ${was.id} ${was.title} · because (${past.source}): ${past.reason}`,
          ]
    })

// Once cancelled: that, and the words behind it.
const cancelLines = (decision: Node): string[] =>
  decision.status !== 'cancelled'
    ? []
    : [
        '   Cancelled',
        ...optional(
          decision.reason === undefined
            ? undefined
            : `   because (${decision.cancelSource}): ${decision.reason}`,
        ),
      ]

const decisionDetails = (state: State, decision: Node): Line[] =>
  [
    `${decision.id} Decision: ${decision.title}`,
    ...pickLines(state, decision),
    ...cancelLines(decision),
    ...decisionCriteriaLines(state, decision),
    '   Options:',
    ...childrenOf(state, decision.id).flatMap(option =>
      optionLines(state, option),
    ),
    ...earlierPickLines(state, decision),
  ].map(text => ({ text, isOpen: decision.status === 'open' }))

const criterionDetails = (state: State, criterion: Criterion): Line[] => {
  const origin = originOf(criterion)
  const where = `on ${criterion.on}${origin === undefined ? '' : `, from ${origin}`}`
  const decision = state.nodes.find(node => node.id === criterion.on)

  const earlier = criterion.versions
    .slice(0, -1)
    .reverse()
    .map(
      version =>
        `  was: ${version.text}${version.origin === undefined ? '' : ` (from ${version.origin})`}`,
    )

  return [
    `${criterion.id} ${currentText(criterion)} (${where})`,
    ...earlier,
  ].map(text => ({ text, isOpen: decision?.status === 'open' }))
}

const actionDetails = (action: Action): Line[] =>
  [
    `${action.id} ${action.text}`,
    `owner: ${action.owner}`,
    withArrow(action.status, actionArrow(action)),
    ...optional(action.reason),
  ].map(text => ({ text, isOpen: action.status === 'open' }))

export const details = (state: State, id: string): Line[] => {
  const node = state.nodes.find(one => one.id === id)
  if (node?.kind === 'decision') return decisionDetails(state, node)
  if (node !== undefined) return nodeDetails(state, node)
  const criterion = state.criteria.find(one => one.id === id)
  if (criterion !== undefined) return criterionDetails(state, criterion)
  const action = state.actions.find(one => one.id === id)

  return action === undefined ? [] : actionDetails(action)
}
