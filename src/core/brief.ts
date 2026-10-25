import type { Goal, State } from './evolve.ts'
import { byCriterionNumber, currentText, judges } from './in-force.ts'
import { nodesInGoal, nodesInTreeOrder, pickedOption } from './overview.ts'

// The short view re-injected after a compaction or a resume (zg-zo2): the
// open goal, its criteria in force, its open nodes, the last decisions and
// its open actions, and where the full view is.
// It stays within the 2k re-injection budget (zg-n27) by cutting long texts
// and long lists.

const MAX_GOAL = 300
const MAX_NODE = 80
const MAX_CRITERION = 60
const MAX_DECISION = 120
const MAX_CRITERIA = 10
const MAX_DECISIONS = 5
const MAX_ACTION = 120
const MAX_ORIGIN = 40
const MAX_LISTED = 20

const cut = (text: string, max: number) => {
  const line = text.replace(/\s+/g, ' ').trim()

  return line.length <= max ? line : `${line.slice(0, max - 1)}…`
}

const listed = (heading: string, lines: string[]) =>
  lines.length === 0
    ? []
    : [
        heading,
        ...lines.slice(0, MAX_LISTED),
        ...(lines.length > MAX_LISTED
          ? [`- and ${lines.length - MAX_LISTED} more`]
          : []),
      ]

const criteriaLine = (state: State, goal: Goal): string[] => {
  const judging = new Set(
    nodesInGoal(state, goal)
      .filter(judges)
      .map(node => node.id),
  )
  const all = state.criteria
    .filter(criterion => judging.has(criterion.on))
    .sort(byCriterionNumber)
    .map(
      criterion =>
        `${criterion.id} ${cut(currentText(criterion), MAX_CRITERION)} (${criterion.on})`,
    )
  if (all.length === 0) return []
  const more =
    all.length > MAX_CRITERIA ? [`and ${all.length - MAX_CRITERIA} more`] : []

  return [`Criteria: ${[...all.slice(0, MAX_CRITERIA), ...more].join(' · ')}`]
}

// The decided decisions of the goal, the last decided last.
const decisionLines = (state: State, goal: Goal): string[] => {
  const inGoal = nodesInGoal(state, goal).filter(
    node => node.kind === 'decision' && node.status === 'decided',
  )
  const lines = state.decidedOrder
    .flatMap(id => inGoal.filter(node => node.id === id))
    .slice(-MAX_DECISIONS)
    .map(node => {
      const picked = pickedOption(state, node)
      const text =
        picked === undefined ? node.title : `${node.title} → ${picked.title}`

      return `- ${node.id} ${cut(text, MAX_DECISION)} (under ${node.parent})`
    })

  return lines.length === 0 ? [] : ['Decisions:', ...lines]
}

export const brief = (state: State): string | undefined => {
  if (state.goals.length === 0) return undefined
  const goal = state.goals.find(one => one.status === 'open')
  const head =
    goal === undefined
      ? state.handoffStands
        ? 'zg: no goal is open, and the handoff is written.'
        : 'zg: no goal is open.'
      : `zg: the goal is ${goal.id} ${cut(goal.text, MAX_GOAL)}${goal.origin === undefined ? '' : ` (${cut(goal.origin, MAX_ORIGIN)})`}`
  const nodes = nodesInTreeOrder(state)
    .filter(node => node.status === 'open')
    .map(
      node =>
        `- ${node.id} ${cut(node.title, MAX_NODE)} (under ${node.parent})`,
    )
  const actions = state.actions
    .filter(action => action.status === 'open')
    .map(
      action =>
        `- ${action.id} ${cut(action.text, MAX_ACTION)} (${action.owner})`,
    )

  return [
    head,
    ...(goal === undefined ? [] : criteriaLine(state, goal)),
    ...listed('Open nodes:', nodes),
    ...(goal === undefined ? [] : decisionLines(state, goal)),
    ...listed('Open actions:', actions),
    'Full view: mcp__zg__show.',
  ].join('\n')
}
