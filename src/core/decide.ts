import type { Command } from './commands.ts'
import type { Event } from './events.ts'
import {
  type Action,
  type Goal,
  type Node,
  type State,
  evolve,
} from './evolve.ts'
import { type Holder, holds } from './containment.ts'
import { nextId, nextOptionId } from './ids.ts'
import { currentText } from './in-force.ts'
import { joinList } from './join-list.ts'
import { bySiblingOrder } from './overview.ts'
import { repliesOn } from './replies-on.ts'
import { type Child, stillOpenUnder } from './still-open.ts'

// The rules live here and nowhere else (zg-kux). A command that would break
// one is refused with the reason and a fix (zg-su8).

export type Refusal = { reason: string; fix: string }

export type Decided = { events: Event[] } | { refusal: Refusal }

const refuse = (reason: string, fix: string): { refusal: Refusal } => ({
  refusal: { reason, fix },
})

const goalId = (goals: readonly Goal[]) =>
  goals.length === 0 ? 'G' : `G${goals.length + 1}`

const openGoal = (state: State) =>
  state.goals.find(goal => goal.status === 'open')

const openActions = (state: State) =>
  state.actions.filter(action => action.status === 'open')

const openNodes = (state: State) =>
  state.nodes.filter(node => node.status === 'open')

const ids = (items: readonly { id: string }[]) =>
  items.map(item => item.id).join(', ')

// Commands on an action name one that exists and is still open.
const findOpen = (
  state: State,
  id: string,
): { action: Action } | { refusal: Refusal } => {
  const action = state.actions.find(one => one.id === id)
  const open = openActions(state)
  const pick =
    open.length === 0
      ? 'There are no open actions.'
      : `The open actions are ${ids(open)}.`
  if (action === undefined) {
    return { refusal: { reason: `There is no action ${id}.`, fix: pick } }
  }
  if (action.status !== 'open') {
    return {
      refusal: { reason: `${id} is already ${action.status}.`, fix: pick },
    }
  }

  return { action }
}

// Which threads are open, as a clause for the caller to make a sentence of.
const openThreadsClause = (state: State) => {
  const open = openNodes(state).filter(node => node.kind === 'thread')

  return open.length === 0
    ? 'there are no open threads'
    : `the open threads are ${ids(open)}`
}

const openThreadsFix = (state: State) => {
  const clause = openThreadsClause(state)

  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`
}

// What the commands that act on any node call a node: a thread while every
// open node is one, so the reason and the fix of a refusal agree.
const openKind = (state: State) =>
  openNodes(state).every(node => node.kind === 'thread') ? 'thread' : 'node'

const openNodesClause = (state: State) => {
  const open = openNodes(state)
  if (open.length === 0) return 'there are no open threads'

  return `the open ${openKind(state)}s are ${ids(open)}`
}

// The goal and the open nodes that can hold a new node of this kind.
const openParentsFix = (
  state: State,
  goal: Goal,
  child: Node['kind'],
): string => {
  const parents = [
    goal.id,
    ...openNodes(state)
      .filter(node => holds(node.kind, child))
      .map(node => node.id),
  ]

  return `Open it under ${joinList(parents, 'or')}.`
}

const openNodesFix = (state: State) => {
  const clause = openNodesClause(state)

  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`
}

// A node that takes work is open. A merged one is refused the same way
// everywhere, since its target carries on; any other closed one is refused
// as the caller words it.
const refuseNotOpen = (
  node: Node,
  closed: (node: Node) => { refusal: Refusal },
): { refusal: Refusal } | undefined => {
  if (node.status === 'merged') {
    return refuse(
      `${node.id} is already merged.`,
      `${node.id} was merged into ${node.into}; work on ${node.into} instead.`,
    )
  }

  return node.status === 'open' ? undefined : closed(node)
}

// A command that acts on a node names one that exists and is still open.
const findOpenNode = (
  state: State,
  id: string,
): { node: Node } | { refusal: Refusal } => {
  const node = state.nodes.find(one => one.id === id)
  if (node === undefined) {
    return {
      refusal: {
        reason: `There is no ${openKind(state)} ${id}.`,
        fix: openNodesFix(state),
      },
    }
  }
  const blocked = refuseNotOpen(node, closed =>
    refuse(`${id} is already ${closed.status}.`, openNodesFix(state)),
  )
  if (blocked !== undefined) return blocked

  return { node }
}

// A parent is the open goal or an open node; containment is checked
// separately.
const refuseParent = (
  state: State,
  goal: Goal,
  parent: string,
  fixes: { missing: string; closed: (target: Node) => string },
): Decided | undefined => {
  const target = state.nodes.find(node => node.id === parent)
  if (parent !== goal.id && target === undefined) {
    return refuse(
      `One parent: there is no ${openKind(state)} ${parent}.`,
      fixes.missing,
    )
  }

  return target === undefined
    ? undefined
    : refuseNotOpen(target, closed =>
        refuse(
          `One parent: ${parent} is already ${closed.status}.`,
          fixes.closed(closed),
        ),
      )
}

const holderOf = (state: State, goal: Goal, id: string): Holder | undefined =>
  id === goal.id ? 'goal' : state.nodes.find(node => node.id === id)?.kind

// Where a closed parent sends a new node: under the closed one's parent, or,
// when that cannot hold it, beside that parent.
const besideParent = (
  state: State,
  closed: Node,
  child: Node['kind'],
): string | undefined => {
  // A goal is not a node, and holds everything a child can be.
  const parent = state.nodes.find(node => node.id === closed.parent)

  return parent === undefined || holds(parent.kind, child)
    ? undefined
    : `beside ${parent.id}, under ${parent.parent}`
}

// Where what's new about a closed node goes: under its parent, else beside it.
const newThreadWhere = (state: State, closed: Node): string => {
  const beside = besideParent(state, closed, 'thread')

  return beside === undefined ? `under ${closed.id}'s parent` : `${beside},`
}

const closedParentFix = (
  state: State,
  closed: Node,
  child: Node['kind'],
  sibling: 'thread' | 'node',
): string => {
  const where =
    besideParent(state, closed, child) ??
    `under ${closed.id}'s parent ${closed.parent}`

  return `Open it ${where}, or under another open ${sibling}.`
}

// A decision holds only its options (the containment table). The fix is the
// caller's, since opening and nesting word it differently.
const refuseDecisionParent = (
  holder: Holder | undefined,
  parent: string,
  child: Node['kind'],
  fix: string,
): Decided | undefined => {
  if (holder !== 'decision' || holds(holder, child)) return undefined

  return refuse(
    `One parent: ${parent} is a decision, and holds only its options.`,
    fix,
  )
}

// Children close first: a parent is refused while any child is open.
const refuseOpenChildren = (
  children: readonly Child[],
  parent: string,
  fix: string,
): Decided | undefined =>
  children.length === 0
    ? undefined
    : refuse(`Children close first: ${stillOpenUnder(children, parent)}`, fix)

const openChildrenOf = (state: State, parent: string): Child[] =>
  state.nodes
    .filter(node => node.parent === parent && node.status === 'open')
    .map(node => ({ id: node.id, label: node.title }))

const threadChildrenFix =
  'Show the human the open children and ask how each ends, or propose one outcome that settles them for the human to confirm.'

// A decision's options are its defined effect, so they are exempt; what is
// open under any of them is not.
const refuseOpenUnderOptions = (
  state: State,
  decision: string,
): Decided | undefined => {
  const options = state.nodes
    .filter(node => node.kind === 'option' && node.parent === decision)
    .sort(bySiblingOrder)
  const sentences = options
    .map(option => ({
      option: option.id,
      children: openChildrenOf(state, option.id),
    }))
    .filter(one => one.children.length > 0)
    .map(one => stillOpenUnder(one.children, one.option))

  return sentences.length === 0
    ? undefined
    : refuse(`Children close first: ${sentences.join(' ')}`, threadChildrenFix)
}

const onAction = (
  state: State,
  id: string,
  event: (action: Action) => Event,
): Decided => {
  const found = findOpen(state, id)

  return 'refusal' in found ? found : { events: [event(found.action)] }
}

const ofReason = (reason: string | undefined) =>
  reason === undefined ? {} : { reason }

const decideOpen = (state: State, command: Command & { type: 'OpenGoal' }) => {
  const open = openGoal(state)
  if (open !== undefined) {
    return refuse(
      `One open goal: ${open.id} is still open.`,
      `Ask the human whether ${open.id} is achieved, failed or cancelled, and close it first; or keep working on ${open.id}.`,
    )
  }

  return {
    events: [
      {
        type: 'GoalOpened',
        at: command.at,
        goal: goalId(state.goals),
        text: command.text,
        ...(command.origin === undefined ? {} : { origin: command.origin }),
      } satisfies Event,
    ],
  }
}

const decideAdd = (state: State, command: Command & { type: 'AddAction' }) => {
  if (openGoal(state) === undefined) {
    return refuse(
      'One parent: an action belongs to the open goal, and no goal is open.',
      'Open a goal first: the human starts one with /zg:open.',
    )
  }

  return {
    events: [
      {
        type: 'ActionAdded',
        at: command.at,
        action: nextId(
          'A',
          state.actions.map(action => action.id),
        ),
        text: command.text,
        owner: command.owner,
        ...(command.quote === undefined ? {} : { quote: command.quote }),
      } satisfies Event,
    ],
  }
}

// A closed decision, or an option of one: neither takes anything more, and
// there is no parent of theirs to send the new node beside. An option dropped
// from a decision that is still open is not that.
const isEndedWithDecision = (state: State, closed: Node): boolean =>
  closed.kind === 'decision' ||
  (closed.kind === 'option' &&
    state.nodes.find(one => one.id === closed.parent)?.status !== 'open')

const decideOpenThread = (
  state: State,
  command: Command & { type: 'OpenThread' },
): Decided => {
  const goal = openGoal(state)
  if (goal === undefined) {
    return refuse(
      "One parent: a thread belongs to the open goal's tree, and no goal is open.",
      'Open a goal first: the human starts one with /zg:open.',
    )
  }
  const { at, parent, title } = command
  const blocked = refuseParent(state, goal, parent, {
    missing:
      openKind(state) === 'thread'
        ? openThreadsFix(state)
        : openParentsFix(state, goal, 'thread'),
    closed: target =>
      isEndedWithDecision(state, target)
        ? openParentsFix(state, goal, 'thread')
        : closedParentFix(state, target, 'thread', 'thread'),
  })
  if (blocked !== undefined) return blocked
  const misplaced = refuseDecisionParent(
    holderOf(state, goal, parent),
    parent,
    'thread',
    `Open the thread under one of ${parent}'s options, or beside ${parent}.`,
  )
  if (misplaced !== undefined) return misplaced

  return {
    events: [
      {
        type: 'ThreadOpened',
        at,
        thread: nextId(
          'T',
          state.nodes.map(node => node.id),
        ),
        parent,
        title,
      },
    ],
  }
}

const decideOpenDecision = (
  state: State,
  command: Command & { type: 'OpenDecision' },
): Decided => {
  const goal = openGoal(state)
  if (goal === undefined) {
    return refuse(
      "One parent: a decision belongs to the open goal's tree, and no goal is open.",
      'Open a goal first: the human starts one with /zg:open.',
    )
  }
  const { at, parent, title } = command
  const target = state.nodes.find(node => node.id === parent)
  if (parent !== goal.id && target === undefined) {
    return refuse(
      `There is no node ${parent}.`,
      openParentsFix(state, goal, 'decision'),
    )
  }
  const blocked =
    target === undefined
      ? undefined
      : refuseNotOpen(target, closed =>
          refuse(
            `${parent} is already ${closed.status}.`,
            isEndedWithDecision(state, closed)
              ? openParentsFix(state, goal, 'decision')
              : closedParentFix(state, closed, 'decision', 'node'),
          ),
        )
  if (blocked !== undefined) return blocked
  const misplaced = refuseDecisionParent(
    holderOf(state, goal, parent),
    parent,
    'decision',
    `Open the decision under one of ${parent}'s options, or beside ${parent}.`,
  )
  if (misplaced !== undefined) return misplaced

  return {
    events: [
      {
        type: 'DecisionOpened',
        at,
        decision: nextId(
          'D',
          state.nodes.map(node => node.id),
        ),
        parent,
        title,
      },
    ],
  }
}

const openDecisions = (state: State) =>
  openNodes(state).filter(node => node.kind === 'decision')

const openDecisionsFix = (state: State) => {
  const open = openDecisions(state)

  return open.length === 0
    ? 'There are no open decisions.'
    : `The open decisions are ${ids(open)}.`
}

const aKind = (node: Node) =>
  `${node.kind === 'option' ? 'an' : 'a'} ${node.kind}`

// A command on a decision names one that exists and whose status it accepts;
// what refusing a node that is no decision says is the caller's. An open
// decision is always accepted.
const findDecision = (
  state: State,
  id: string,
  notADecision: (found: Node) => { refusal: Refusal },
  accepts: readonly Node['status'][],
): { node: Node } | { refusal: Refusal } => {
  const found = state.nodes.find(node => node.id === id)
  if (found === undefined) {
    return refuse(`There is no decision ${id}.`, openDecisionsFix(state))
  }
  if (found.kind !== 'decision') return notADecision(found)
  if (accepts.includes(found.status)) return { node: found }
  const blocked = refuseNotOpen(found, closed =>
    refuse(`${id} is already ${closed.status}.`, openDecisionsFix(state)),
  )

  return blocked ?? { node: found }
}

// A command on a decision names one that exists and is still open.
const findOpenDecision = (
  state: State,
  id: string,
  notADecision: (found: Node) => { refusal: Refusal },
) => findDecision(state, id, notADecision, ['open'])

const decideAddOption = (
  state: State,
  command: Command & { type: 'AddOption' },
): Decided => {
  const { at, decision, title } = command
  const found = findOpenDecision(state, decision, notADecision =>
    refuse(
      `One parent: ${decision} is ${aKind(notADecision)}, and only a decision holds options.`,
      `Open a decision under ${decision}, and add the option there.`,
    ),
  )
  if ('refusal' in found) return found
  const twin = openNodes(state).find(
    node => node.parent === decision && node.title === title,
  )
  if (twin !== undefined) {
    return refuse(
      `${decision} already has the option ${title} (${twin.id}).`,
      `Reply to ${twin.id} instead.`,
    )
  }

  return {
    events: [
      {
        type: 'OptionAdded',
        at,
        option: nextOptionId(
          decision,
          state.nodes.map(node => node.id),
        ),
        decision,
        title,
      },
    ],
  }
}

// Where a criterion may have come up: the goal or any node, closed or not.
const knowsOrigin = (state: State, id: string): boolean =>
  state.goals.some(goal => goal.id === id) ||
  state.nodes.some(node => node.id === id)

// A criterion belongs to an open or decided decision (one parent).
const decideAddCriterion = (
  state: State,
  command: Command & { type: 'AddCriterion' },
): Decided => {
  const { at, on, text, origin } = command
  if (state.goals.some(goal => goal.id === on)) {
    return refuse(
      'One parent: a criterion belongs to a decision, not the goal.',
      'Open the decision it serves.',
    )
  }
  const found = findDecision(
    state,
    on,
    notADecision => {
      const open = openDecisions(state).map(node => node.id)
      const attach =
        open.length === 0 ? '' : `, or attach it to ${joinList(open, 'or')}`

      return refuse(
        `One parent: a criterion belongs to a decision, and ${on} is ${aKind(notADecision)}.`,
        `Open the decision it serves under ${on}${attach}.`,
      )
    },
    ['open', 'decided'],
  )
  if ('refusal' in found) return found
  if (origin !== undefined && !knowsOrigin(state, origin)) {
    return refuse(
      `There is no node ${origin}.`,
      'Name the node it came up in, or leave origin out.',
    )
  }

  return {
    events: [
      {
        type: 'CriterionAdded',
        at,
        criterion: nextId(
          'C',
          state.criteria.map(criterion => criterion.id),
        ),
        on,
        text,
        ...(origin === undefined ? {} : { origin }),
      },
    ],
  }
}

// A revision names the criterion and the node that changed it; its decision
// may be open or decided, as when adding. A criterion is only ever on a
// decision (add enforces it), so findDecision only refuses here for a
// cancelled or merged one.
const decideReviseCriterion = (
  state: State,
  command: Command & { type: 'ReviseCriterion' },
): Decided => {
  const { at, id, text, origin } = command
  const criterion = state.criteria.find(one => one.id === id)
  if (criterion === undefined) {
    return refuse(
      `There is no criterion ${id}.`,
      state.criteria.length === 0
        ? 'There are no criteria.'
        : `The criteria are ${ids(state.criteria)}.`,
    )
  }
  if (!knowsOrigin(state, origin)) {
    return refuse(
      `There is no node ${origin}.`,
      'Name the node the change came from.',
    )
  }
  if (text.trim() === currentText(criterion).trim()) {
    return refuse(
      `${id} already says that.`,
      'Revise it only when the wording changes.',
    )
  }
  const found = findDecision(
    state,
    criterion.on,
    notADecision =>
      refuse(`${id} is on ${notADecision.id}, which is not a decision.`, ''),
    ['open', 'decided'],
  )
  if ('refusal' in found) return found

  return {
    events: [{ type: 'CriterionRevised', at, criterion: id, text, origin }],
  }
}

const decideResolveThread = (
  state: State,
  command: Command & { type: 'ResolveThread' },
): Decided => {
  const { at, thread, outcome, source, reason } = command
  const found = findOpenNode(state, thread)
  if ('refusal' in found) return found
  if (found.node.kind === 'decision') {
    return refuse(
      `Closing says how: ${thread} is a decision.`,
      'Decide it with an option, or cancel it.',
    )
  }
  if (found.node.kind === 'option') {
    return refuse(
      `Closing says how: ${thread} is an option.`,
      `Decide ${found.node.parent}, or cancel ${thread}.`,
    )
  }
  const blocked = refuseOpenChildren(
    openChildrenOf(state, thread),
    thread,
    threadChildrenFix,
  )
  if (blocked !== undefined) return blocked
  if (outcome === undefined || outcome.trim() === '') {
    return refuse(
      'Closing says how: a resolved thread needs its outcome.',
      `Pass what ${thread} settled as the outcome: a short summary, your words are fine.`,
    )
  }

  return {
    events: [{ type: 'ThreadResolved', at, thread, outcome, source, reason }],
  }
}

const decideMakeDecision = (
  state: State,
  command: Command & { type: 'MakeDecision' },
): Decided => {
  const { at, decision, option, source, reason } = command
  const found = findOpenDecision(state, decision, notADecision => {
    const reason = `${decision} is ${aKind(notADecision)}, not a decision.`
    if (notADecision.kind === 'option') {
      return refuse(
        reason,
        `Decide ${notADecision.parent} with option ${decision}.`,
      )
    }
    const open = openDecisions(state)
    const instead =
      open.length === 0
        ? ''
        : `, or decide ${joinList(
            open.map(node => node.id),
            'or',
          )}`

    return refuse(reason, `Resolve ${decision} with an outcome${instead}.`)
  })
  if ('refusal' in found) return found
  const open = state.nodes.filter(
    node =>
      node.kind === 'option' &&
      node.parent === decision &&
      node.status === 'open',
  )
  if (open.length === 0) {
    return refuse(
      `Closing says how: ${decision} has no open option.`,
      `Add one, or cancel ${decision}.`,
    )
  }
  const fix = `${decision}'s open options are ${joinList(
    open.map(node => node.id),
    'and',
  )}.`
  const picked = state.nodes.find(node => node.id === option)
  if (picked === undefined) {
    return refuse(`${decision} has no option ${option}.`, fix)
  }
  if (picked.kind !== 'option' || picked.parent !== decision) {
    return refuse(`${option} is not one of ${decision}'s options.`, fix)
  }
  if (picked.status !== 'open') {
    return refuse(
      `Closing says how: ${option} is already ${picked.status}.`,
      fix,
    )
  }
  const unfinished = refuseOpenUnderOptions(state, decision)
  if (unfinished !== undefined) return unfinished

  return {
    events: [{ type: 'DecisionMade', at, decision, option, source, reason }],
  }
}

const decideCancelNode = (
  state: State,
  command: Command & { type: 'CancelNode' },
): Decided => {
  const { at, node, source, reason } = command
  const found = findOpenNode(state, node)
  if ('refusal' in found) return found
  const blocked =
    found.node.kind === 'decision'
      ? refuseOpenUnderOptions(state, node)
      : refuseOpenChildren(openChildrenOf(state, node), node, threadChildrenFix)
  if (blocked !== undefined) return blocked

  return { events: [{ type: 'NodeCancelled', at, node, source, reason }] }
}

const decideReplyToNode = (
  state: State,
  command: Command & { type: 'ReplyToNode' },
): Decided => {
  const { at, node, author, text } = command
  const target = state.nodes.find(one => one.id === node)
  if (target === undefined) {
    return refuse(
      `There is no ${openKind(state)} ${node}.`,
      openNodesFix(state),
    )
  }
  const blocked = refuseNotOpen(target, closed =>
    refuse(
      `${node} is already ${closed.status}.`,
      `Open a new thread ${newThreadWhere(state, closed)} for what's new; ${openNodesClause(state)}.`,
    ),
  )
  if (blocked !== undefined) return blocked

  return { events: [{ type: 'NodeReplied', at, node, author, text }] }
}

// Whether `id` sits anywhere below `ancestor`; a cycle in the log ends it.
const isBelow = (state: State, id: string, ancestor: string): boolean => {
  const seen = new Set<string>()
  let current = state.nodes.find(node => node.id === id)
  while (current !== undefined && !seen.has(current.id)) {
    if (current.parent === ancestor) return true
    seen.add(current.id)
    current = state.nodes.find(node => node.id === current?.parent)
  }

  return false
}

// A closed thread stays where it rolled up, and says so (`threadReason`); a
// decision or option that ended is simply ended, and the fix lists what is
// open.
const refuseEndedMove = (
  state: State,
  closed: Node,
  threadReason: string,
): { refusal: Refusal } =>
  closed.kind === 'thread'
    ? refuse(
        threadReason,
        `Leave ${closed.id} where it is; if it comes up again, open a new thread.`,
      )
    : refuse(
        `${closed.id} is already ${closed.status}.`,
        `Leave ${closed.id} where it is; ${openNodesClause(state)}.`,
      )

// The parents nest would accept for a node: the open goal unless the node is
// already under it, then the open threads outside its branch.
const nestFix = (state: State, goal: Goal, moving: Node): string => {
  const parents = [
    ...(moving.parent === goal.id || !holds('goal', moving.kind)
      ? []
      : [goal.id]),
    ...openNodes(state)
      .filter(
        node =>
          holds(node.kind, moving.kind) &&
          node.id !== moving.id &&
          node.id !== moving.parent &&
          !isBelow(state, node.id, moving.id),
      )
      .map(node => node.id),
  ]
  if (parents.length === 0) {
    return `Leave ${moving.id} where it is: no other open parent can take it.`
  }

  return `Nest ${moving.id} under ${joinList(parents, 'or')}.`
}

const decideNestNode = (
  state: State,
  command: Command & { type: 'NestNode' },
): Decided => {
  const goal = openGoal(state)
  if (goal === undefined) {
    return refuse(
      "One parent: a thread belongs to the open goal's tree, and no goal is open.",
      'Open a goal first: the human starts one with /zg:open.',
    )
  }
  const { at, node, parent, source } = command
  const moving = state.nodes.find(one => one.id === node)
  if (moving === undefined) {
    return refuse(
      `One parent: there is no ${openKind(state)} ${node}.`,
      openNodesFix(state),
    )
  }
  const movingBlocked = refuseNotOpen(moving, closed =>
    refuseEndedMove(
      state,
      closed,
      `One parent: ${node} is already ${closed.status}; a closed thread stays where it rolled up.`,
    ),
  )
  if (movingBlocked !== undefined) return movingBlocked
  const fix = nestFix(state, goal, moving)
  if (parent === node) {
    return refuse("One parent: a thread can't be its own parent.", fix)
  }
  const parentBlocked = refuseParent(state, goal, parent, {
    missing: fix,
    closed: () => fix,
  })
  if (parentBlocked !== undefined) return parentBlocked
  const holder = holderOf(state, goal, parent)
  if (
    moving.kind === 'option' &&
    holder !== undefined &&
    !holds(holder, 'option')
  ) {
    return refuse('One parent: an option sits under a decision.', fix)
  }
  const misplaced = refuseDecisionParent(holder, parent, moving.kind, fix)
  if (misplaced !== undefined) return misplaced
  if (isBelow(state, parent, node)) {
    return refuse(
      `One parent: ${parent} is under ${node}; a thread can't nest under its own descendant.`,
      fix,
    )
  }
  if (moving.parent === parent) {
    return refuse(`One parent: ${node} is already under ${parent}.`, fix)
  }

  return { events: [{ type: 'NodeMoved', at, node, parent, source }] }
}

const decideMergeNodes = (
  state: State,
  command: Command & { type: 'MergeNodes' },
): Decided => {
  const { at, from, into, source, reason } = command
  for (const id of from) {
    const folding = state.nodes.find(one => one.id === id)
    if (folding === undefined) {
      return refuse(
        `There is no ${openKind(state)} ${id}.`,
        openNodesFix(state),
      )
    }
    const blocked = refuseNotOpen(folding, closed =>
      refuseEndedMove(
        state,
        closed,
        `${id} is already ${closed.status}; a closed thread stays where it rolled up.`,
      ),
    )
    if (blocked !== undefined) return blocked
    if (folding.kind === 'decision') {
      return refuse(
        "One parent: decisions don't merge.",
        `Nest ${id}'s options under ${into}, add its criteria to ${into}, then cancel ${id} naming ${into}.`,
      )
    }
  }
  const fix = `Merge ${joinList(from, 'and')} into another open thread, or leave ${from.length > 1 ? 'them where they are' : 'it where it is'}.`
  if (from.includes(into)) {
    return refuse("One parent: a thread can't merge into itself.", fix)
  }
  const target = state.nodes.find(one => one.id === into)
  if (target === undefined) {
    return refuse(
      `There is no ${openKind(state)} ${into}.`,
      openNodesFix(state),
    )
  }
  const firstOption = from
    .map(id => state.nodes.find(one => one.id === id))
    .find(one => one?.kind === 'option')
  const targetFix =
    firstOption === undefined
      ? fix
      : `Merge ${firstOption.id} into another open option of ${firstOption.parent}, or leave it where it is.`
  const blocked = refuseNotOpen(target, closed =>
    refuse(`${into} is already ${closed.status}.`, targetFix),
  )
  if (blocked !== undefined) return blocked
  for (const id of from) {
    const folding = state.nodes.find(one => one.id === id)
    if (folding?.kind === 'option' && target.parent !== folding.parent) {
      return refuse(
        'One parent: options merge only within their decision.',
        `Merge ${id} into another open option of ${folding.parent}, or leave it where it is.`,
      )
    }
    // What a node held goes to the target, so the target must hold its kind.
    const misplaced =
      folding === undefined
        ? undefined
        : refuseDecisionParent(target.kind, into, folding.kind, fix)
    if (misplaced !== undefined) return misplaced
  }
  const ancestor = from.find(id => isBelow(state, into, id))
  if (ancestor !== undefined) {
    return refuse(
      `One parent: ${into} is under ${ancestor}; ${into} can't take its own ancestor's children.`,
      `Merge ${ancestor} into a thread outside its own branch, or leave it where it is.`,
    )
  }

  return { events: [{ type: 'NodeMerged', at, from, into, source, reason }] }
}

const decideMoveReply = (
  state: State,
  command: Command & { type: 'MoveReply' },
): Decided => {
  const { at, node, to } = command
  const source = state.nodes.find(one => one.id === node)
  if (source === undefined) {
    return refuse(
      `There is no ${openKind(state)} ${node}.`,
      openNodesFix(state),
    )
  }
  const sourceBlocked = refuseNotOpen(source, closed =>
    closed.kind === 'thread'
      ? refuse(
          `${node} is already ${closed.status}.`,
          'A closed thread keeps its replies; reply on the right thread with the words instead.',
        )
      : refuse(
          `${node} is already ${closed.status}.`,
          `${node} keeps its replies; reply with the words on the right node instead: ${openNodesClause(state)}.`,
        ),
  )
  if (sourceBlocked !== undefined) return sourceBlocked
  const found = findOpenNode(state, to)
  if ('refusal' in found) return found
  const replies = repliesOn(state, node)
  if (replies.length === 0) {
    return refuse(
      `${node} has no replies.`,
      "Name the thread that holds the reply as id; show lists each thread's replies.",
    )
  }
  const ordinal = command.ordinal ?? replies.length
  const moving = replies[ordinal - 1]
  if (moving === undefined) {
    return refuse(
      `${node} has ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}, none numbered ${ordinal}.`,
      `Pass an ordinal from 1 to ${replies.length}, as show numbers them, or leave it out for the latest.`,
    )
  }
  const twin = replies.find(
    one => one.ordinal !== ordinal && one.reply.at === moving.reply.at,
  )
  if (twin !== undefined) {
    const [low, high] = [twin.ordinal, ordinal].sort((x, y) => x - y)
    return refuse(
      `${node}'s replies #${low} and #${high} were recorded at the same moment, so zg can't tell them apart.`,
      'Leave them where they are; reply on the right thread with the words instead.',
    )
  }
  if (node === to) {
    return refuse(
      `The reply is already on ${to}.`,
      'Pass the thread the reply belongs on as to.',
    )
  }

  if (repliesOn(state, to).some(one => one.reply.at === moving.reply.at)) {
    return refuse(
      `${to} already holds a reply recorded at the same moment as ${node}'s #${ordinal}, so zg couldn't tell them apart.`,
      `Leave it where it is; reply on ${to} with the words instead.`,
    )
  }

  return {
    events: [{ type: 'ReplyMoved', at, node, reply: moving.reply.at, to }],
  }
}

const decideCloseGoal = (
  state: State,
  command: Command & { type: 'CloseGoal' },
): Decided => {
  const goal = openGoal(state)
  if (goal === undefined) {
    return refuse(
      'No goal is open.',
      'Nothing to close: write the handoff, or the human opens a goal with /zg:open.',
    )
  }
  const blocked = refuseOpenChildren(
    [
      ...openChildrenOf(state, goal.id),
      ...openActions(state).map(action => ({
        id: action.id,
        label: action.text,
      })),
    ],
    goal.id,
    'Ask the human how each ends, or, if their words end the whole session, cancel every open item with those words, children first, then the goal.',
  )
  if (blocked !== undefined) return blocked
  const { at, source, reason } = command
  switch (command.as) {
    case 'achieved':
      return {
        events: [
          {
            type: 'GoalAchieved',
            at,
            goal: goal.id,
            source,
            ...ofReason(reason),
          },
        ],
      }
    case 'failed':
      if (reason === undefined || reason.trim() === '') {
        return refuse(
          `Closing says how: a failed goal needs the reason it can't be done.`,
          `Ask the human why ${goal.id} failed, and pass it as the reason.`,
        )
      }
      return {
        events: [{ type: 'GoalFailed', at, goal: goal.id, source, reason }],
      }
    case 'cancelled':
      return {
        events: [
          {
            type: 'GoalCancelled',
            at,
            goal: goal.id,
            source,
            ...ofReason(reason),
          },
        ],
      }
  }
}

const decideHandoff = (
  state: State,
  command: Command & { type: 'WriteHandoff' },
): Decided => {
  const goal = openGoal(state)
  const actions = openActions(state)
  const open = [
    ...(goal === undefined ? [] : [goal.id]),
    ...openNodes(state).map(node => node.id),
    ...actions.map(a => a.id),
  ]
  if (open.length > 0) {
    return refuse(
      `Close only when nothing is open: ${open.join(', ')} still open.`,
      'Ask the human how each one ends: the goal achieved, failed or cancelled; each thread resolved or cancelled; each action done, cancelled, or exported to the handoff for filing.',
    )
  }
  const { at, next, decisions, references } = command

  return {
    events: [{ type: 'HandoffWritten', at, next, decisions, references }],
  }
}

const decideCloseSession = (
  state: State,
  command: Command & { type: 'CloseSession' },
): Decided => {
  if (!state.handoffStands) {
    return refuse(
      'Close only when nothing is open: the session closes after its handoff is written, and none stands.',
      'Run /zg:close in the session to close the goal and write the handoff.',
    )
  }

  return {
    events: [{ type: 'SessionClosed', at: command.at, via: command.via }],
  }
}

// A realization recorded in one step: the decision is opened, given its one
// option and decided, each step checked on the state the one before left.
const decideRecordDecision = (
  state: State,
  command: Command & { type: 'RecordDecision' },
): Decided => {
  const { at, parent, title, choice, source, reason } = command
  const opened = decideOpenDecision(state, {
    type: 'OpenDecision',
    at,
    parent,
    title,
  })
  if ('refusal' in opened) return opened
  const withDecision = opened.events.reduce(evolve, state)
  // Opening a decision yields exactly one DecisionOpened.
  const [opening] = opened.events as [
    Extract<Event, { type: 'DecisionOpened' }>,
  ]
  const decision = opening.decision
  const added = decideAddOption(withDecision, {
    type: 'AddOption',
    at,
    decision,
    title: choice,
  })
  if ('refusal' in added) return added
  const withOption = added.events.reduce(evolve, withDecision)
  // Adding an option yields exactly one OptionAdded.
  const [adding] = added.events as [Extract<Event, { type: 'OptionAdded' }>]
  const made = decideMakeDecision(withOption, {
    type: 'MakeDecision',
    at,
    decision,
    option: adding.option,
    source,
    reason,
  })
  if ('refusal' in made) return made

  return { events: [...opened.events, ...added.events, ...made.events] }
}

export const decide = (state: State, command: Command): Decided => {
  if (state.isClosed) {
    return refuse(
      'This session is closed: its handoff was written and it was cleared.',
      'Start a new session, and open its goal with /zg:open.',
    )
  }
  const { at } = command
  switch (command.type) {
    case 'OpenGoal':
      return decideOpen(state, command)
    case 'AddAction':
      return decideAdd(state, command)
    case 'CompleteAction':
      return onAction(state, command.action, action => ({
        type: 'ActionDone',
        at,
        action: action.id,
        source: command.source,
        ...ofReason(command.reason),
      }))
    case 'CancelAction':
      return onAction(state, command.action, action => ({
        type: 'ActionCancelled',
        at,
        action: action.id,
        source: command.source,
        ...ofReason(command.reason),
      }))
    case 'ExportAction':
      if (command.ref.trim() === '') {
        return refuse(
          'Exports keep their reference: the export has none.',
          `Pass where ${command.action} went (a bead ID, ticket key or path), or "handoff" to list it for the human to file.`,
        )
      }
      return onAction(state, command.action, action => ({
        type: 'ActionExported',
        at,
        action: action.id,
        ref: command.ref,
        source: command.source,
        ...ofReason(command.reason),
      }))
    case 'CloseGoal':
      return decideCloseGoal(state, command)
    case 'WriteHandoff':
      return decideHandoff(state, command)
    case 'CloseSession':
      return decideCloseSession(state, command)
    case 'OpenThread':
      return decideOpenThread(state, command)
    case 'OpenDecision':
      return decideOpenDecision(state, command)
    case 'AddOption':
      return decideAddOption(state, command)
    case 'MakeDecision':
      return decideMakeDecision(state, command)
    case 'RecordDecision':
      return decideRecordDecision(state, command)
    case 'AddCriterion':
      return decideAddCriterion(state, command)
    case 'ReviseCriterion':
      return decideReviseCriterion(state, command)
    case 'ResolveThread':
      return decideResolveThread(state, command)
    case 'CancelNode':
      return decideCancelNode(state, command)
    case 'ReplyToNode':
      return decideReplyToNode(state, command)
    case 'NestNode':
      return decideNestNode(state, command)
    case 'MergeNodes':
      return decideMergeNodes(state, command)
    case 'MoveReply':
      return decideMoveReply(state, command)
  }
}
