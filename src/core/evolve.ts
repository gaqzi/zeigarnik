import type {
  Decision,
  Event,
  MoveSource,
  NodeSource,
  Owner,
} from './events.ts'

// The session as the events leave it: a fold, with no rules of its own.

export type Goal = {
  id: string
  text: string
  origin?: string
  status: 'open' | 'achieved' | 'failed' | 'cancelled'
  reason?: string
}

export type Action = {
  id: string
  text: string
  owner: Owner
  status: 'open' | 'done' | 'cancelled' | 'exported'
  reason?: string
  ref?: string
}

export type Node = {
  id: string
  kind: 'thread' | 'decision' | 'option'
  parent: string
  title: string
  status: 'open' | 'resolved' | 'cancelled' | 'merged'
  into?: string
  outcome?: string
  reason?: string
}

export type Reply = { node: string; author: Owner; text: string; at: string }

// Who moved a node; its new parent is on the node.
export type Move = { node: string; source: MoveSource }

// Threads folded into another, in the order they were named, and whose
// words folded them.
export type Merge = { from: string[]; into: string; source: NodeSource }

export type Handoff = {
  next: string
  decisions: Decision[]
  references: string[]
}

export type State = {
  goals: Goal[]
  actions: Action[]
  nodes: Node[]
  // In log order; a reply's number is its place among its node's.
  replies: Reply[]
  moves: Move[]
  merges: Merge[]
  handoff?: Handoff
  // False once anything happens after the handoff was written: it no longer
  // describes the session, and has to be written again.
  handoffStands: boolean
  isClosed: boolean
}

export const initial: State = {
  goals: [],
  actions: [],
  nodes: [],
  replies: [],
  moves: [],
  merges: [],
  handoffStands: false,
  isClosed: false,
}

const setGoal = (state: State, id: string, change: Partial<Goal>): State => ({
  ...state,
  goals: state.goals.map(goal =>
    goal.id === id ? { ...goal, ...change } : goal,
  ),
})

const setAction = (
  state: State,
  id: string,
  change: Partial<Action>,
): State => ({
  ...state,
  actions: state.actions.map(action =>
    action.id === id ? { ...action, ...change } : action,
  ),
})

const setNode = (state: State, id: string, change: Partial<Node>): State => ({
  ...state,
  nodes: state.nodes.map(node =>
    node.id === id ? { ...node, ...change } : node,
  ),
})

const ofReason = (reason: string | undefined) =>
  reason === undefined ? {} : { reason }

const happened = (state: State, event: Event): State => {
  switch (event.type) {
    case 'GoalOpened':
      return {
        ...state,
        goals: [
          ...state.goals,
          {
            id: event.goal,
            text: event.text,
            status: 'open',
            ...(event.origin === undefined ? {} : { origin: event.origin }),
          },
        ],
      }
    case 'ActionAdded':
      return {
        ...state,
        actions: [
          ...state.actions,
          {
            id: event.action,
            text: event.text,
            owner: event.owner,
            status: 'open',
          },
        ],
      }
    case 'ActionDone':
      return setAction(state, event.action, {
        status: 'done',
        ...ofReason(event.reason),
      })
    case 'ActionCancelled':
      return setAction(state, event.action, {
        status: 'cancelled',
        ...ofReason(event.reason),
      })
    case 'ActionExported':
      return setAction(state, event.action, {
        status: 'exported',
        ref: event.ref,
        ...ofReason(event.reason),
      })
    case 'GoalAchieved':
      return setGoal(state, event.goal, {
        status: 'achieved',
        ...ofReason(event.reason),
      })
    case 'GoalFailed':
      return setGoal(state, event.goal, {
        status: 'failed',
        reason: event.reason,
      })
    case 'GoalCancelled':
      return setGoal(state, event.goal, {
        status: 'cancelled',
        ...ofReason(event.reason),
      })
    case 'ThreadOpened':
      return {
        ...state,
        nodes: [
          ...state.nodes,
          {
            id: event.thread,
            kind: 'thread',
            parent: event.parent,
            title: event.title,
            status: 'open',
          },
        ],
      }
    case 'DecisionOpened':
      return {
        ...state,
        nodes: [
          ...state.nodes,
          {
            id: event.decision,
            kind: 'decision',
            parent: event.parent,
            title: event.title,
            status: 'open',
          },
        ],
      }
    case 'OptionAdded':
      return {
        ...state,
        nodes: [
          ...state.nodes,
          {
            id: event.option,
            kind: 'option',
            parent: event.decision,
            title: event.title,
            status: 'open',
          },
        ],
      }
    case 'ThreadResolved':
      return setNode(state, event.thread, {
        status: 'resolved',
        outcome: event.outcome,
        reason: event.reason,
      })
    case 'NodeCancelled':
      return setNode(state, event.node, {
        status: 'cancelled',
        reason: event.reason,
      })
    case 'NodeReplied':
      return {
        ...state,
        replies: [
          ...state.replies,
          {
            node: event.node,
            author: event.author,
            text: event.text,
            at: event.at,
          },
        ],
      }
    case 'ReplyMoved':
      return {
        ...state,
        replies: state.replies.map(reply =>
          reply.node === event.node && reply.at === event.reply
            ? { ...reply, node: event.to }
            : reply,
        ),
      }
    case 'NodeMoved':
      return {
        ...setNode(state, event.node, { parent: event.parent }),
        moves: [...state.moves, { node: event.node, source: event.source }],
      }
    case 'NodeMerged':
      // A merge this build can't read changes nothing, like an unknown event.
      if (!Array.isArray(event.from)) return state

      return {
        ...state,
        nodes: state.nodes.map(node =>
          event.from.includes(node.id)
            ? {
                ...node,
                status: 'merged',
                into: event.into,
                reason: event.reason,
              }
            : event.from.includes(node.parent)
              ? { ...node, parent: event.into }
              : node,
        ),
        merges: [
          ...state.merges,
          { from: event.from, into: event.into, source: event.source },
        ],
      }
    case 'HandoffWritten':
      return {
        ...state,
        handoff: {
          next: event.next,
          decisions: event.decisions,
          references: event.references,
        },
        handoffStands: true,
      }
    case 'SessionClosed':
      return { ...state, isClosed: true }
    default:
      // An event this build doesn't know changes nothing it can show.
      return state
  }
}

export const evolve = (state: State, event: Event): State =>
  happened(
    event.type === 'HandoffWritten' || event.type === 'SessionClosed'
      ? state
      : { ...state, handoffStands: false },
    event,
  )

export const fold = (events: readonly Event[]): State =>
  events.reduce(evolve, initial)
