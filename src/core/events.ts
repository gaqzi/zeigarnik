// The session's events: past-tense domain facts that keep the human's words
// verbatim (zg-tjz). They only grow; a significant change gets a version
// field, and every change needs the human's sign-off (zg-8ex).

export type Owner = 'human' | 'claude'

// Where the human's words came from: picked in the dialog, or typed in chat.
export type Source = 'chat' | 'dialog'

// Who closed a node: the human in chat or the dialog, or Claude on its own.
export type NodeSource = Source | 'claude'

// Who moved a node: the human in chat, or Claude correcting itself.
export type MoveSource = 'chat' | 'claude'

export type Decision = { text: string; lasting: boolean }

// The default sink: an action exported here is listed in the handoff for the
// human to file (zg-2x6).
export const HANDOFF = 'handoff'

export type Event =
  | {
      type: 'GoalOpened'
      at: string
      goal: string
      text: string
      origin?: string
    }
  | {
      type: 'ActionAdded'
      at: string
      action: string
      text: string
      owner: Owner
      quote?: string
    }
  | {
      type: 'ActionDone'
      at: string
      action: string
      source: Source
      reason?: string
    }
  | {
      type: 'ActionCancelled'
      at: string
      action: string
      source: Source
      reason?: string
    }
  | {
      type: 'ActionExported'
      at: string
      action: string
      ref: string
      source: Source
      reason?: string
    }
  | {
      type: 'GoalAchieved'
      at: string
      goal: string
      source: Source
      reason?: string
    }
  | {
      type: 'GoalFailed'
      at: string
      goal: string
      source: Source
      reason: string
    }
  | {
      type: 'GoalCancelled'
      at: string
      goal: string
      source: Source
      reason?: string
    }
  | {
      type: 'ThreadOpened'
      at: string
      thread: string
      parent: string
      title: string
    }
  | {
      type: 'DecisionOpened'
      at: string
      decision: string
      parent: string
      title: string
    }
  | {
      type: 'OptionAdded'
      at: string
      option: string
      decision: string
      title: string
    }
  | {
      type: 'DecisionMade'
      at: string
      decision: string
      option: string
      source: Source
      reason: string
    }
  | {
      type: 'CriterionAdded'
      at: string
      criterion: string
      on: string
      text: string
      origin?: string
    }
  | {
      type: 'CriterionRevised'
      at: string
      criterion: string
      text: string
      origin: string
    }
  | {
      type: 'ThreadResolved'
      at: string
      thread: string
      outcome: string
      source: NodeSource
      reason: string
    }
  | {
      type: 'NodeCancelled'
      at: string
      node: string
      source: NodeSource
      reason: string
    }
  | {
      type: 'NodeReplied'
      at: string
      node: string
      author: Owner
      text: string
    }
  | {
      type: 'NodeMoved'
      at: string
      node: string
      parent: string
      source: MoveSource
    }
  // `reply` is the `at` of the NodeReplied that moves. A node's replies never
  // share an at, each being its own tool call; a move could bring two
  // together, and decide refuses it.
  | { type: 'ReplyMoved'; at: string; node: string; reply: string; to: string }
  | {
      type: 'NodeMerged'
      at: string
      from: string[]
      into: string
      source: NodeSource
      reason: string
    }
  | {
      type: 'HandoffWritten'
      at: string
      next: string
      decisions: Decision[]
      references: string[]
    }
  | { type: 'SessionClosed'; at: string; via: 'clear' }
