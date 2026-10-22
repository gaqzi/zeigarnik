// The session's events: past-tense domain facts that keep the human's words
// verbatim (zg-tjz). They only grow; a significant change gets a version
// field, and every change needs the human's sign-off (zg-8ex).

export type Owner = 'human' | 'claude'

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
  | { type: 'ActionDone'; at: string; action: string }
  | { type: 'ActionCancelled'; at: string; action: string; reason?: string }
  | { type: 'ActionExported'; at: string; action: string; ref: string }
  | { type: 'GoalAchieved'; at: string; goal: string; agreement: string }
  | {
      type: 'GoalFailed'
      at: string
      goal: string
      agreement: string
      reason: string
    }
  | {
      type: 'GoalCancelled'
      at: string
      goal: string
      agreement: string
      reason?: string
    }
  | {
      type: 'HandoffWritten'
      at: string
      next: string
      decisions: Decision[]
      references: string[]
    }
  | { type: 'SessionClosed'; at: string; via: 'clear' }
