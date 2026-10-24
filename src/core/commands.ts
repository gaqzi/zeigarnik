import type { Decision, NodeSource, Owner, Source } from './events.ts'

// Every input becomes one of these, and decide checks it (zg-kux). What the
// core needs from outside, such as the time, comes in the command.

export type GoalEnd = 'achieved' | 'failed' | 'cancelled'

export type Command =
  | { type: 'OpenGoal'; at: string; text: string; origin?: string }
  | {
      type: 'AddAction'
      at: string
      text: string
      owner: Owner
      quote?: string
    }
  | {
      type: 'CompleteAction'
      at: string
      action: string
      source: Source
      reason?: string
    }
  | {
      type: 'CancelAction'
      at: string
      action: string
      source: Source
      reason?: string
    }
  | {
      type: 'ExportAction'
      at: string
      action: string
      ref: string
      source: Source
      reason?: string
    }
  | {
      type: 'CloseGoal'
      at: string
      as: GoalEnd
      source: Source
      reason?: string
    }
  | {
      type: 'WriteHandoff'
      at: string
      next: string
      decisions: Decision[]
      references: string[]
    }
  | { type: 'CloseSession'; at: string; via: 'clear' }
  | { type: 'OpenThread'; at: string; parent: string; title: string }
  | {
      type: 'ResolveThread'
      at: string
      thread: string
      outcome?: string
      source: NodeSource
      reason: string
    }
  | {
      type: 'CancelNode'
      at: string
      node: string
      source: NodeSource
      reason: string
    }
  | {
      type: 'ReplyToNode'
      at: string
      node: string
      author: Owner
      text: string
    }
