import type { Command } from './commands.ts'
import type { Event } from './events.ts'

// The tests' model of the domain: one overrides factory per event and
// command, each a valid default that a test changes only where it matters.
// Overrides functions rather than fluent builders: the shapes are flat.

export const AT = '2026-10-22T10:00:00.000Z'

type Of<U, T> = Extract<U, { type: T }>
type Overrides<U, T> = Partial<Omit<Of<U, T>, 'type'>>

const event =
  <T extends Event['type']>(
    type: T,
    defaults: Omit<Of<Event, T>, 'type' | 'at'>,
  ) =>
  (overrides: Overrides<Event, T> = {}): Of<Event, T> =>
    ({ type, at: AT, ...defaults, ...overrides }) as Of<Event, T>

const command =
  <T extends Command['type']>(
    type: T,
    defaults: Omit<Of<Command, T>, 'type' | 'at'>,
  ) =>
  (overrides: Overrides<Command, T> = {}): Of<Command, T> =>
    ({ type, at: AT, ...defaults, ...overrides }) as Of<Command, T>

export const a = {
  goalOpened: event('GoalOpened', { goal: 'G', text: 'Pick a holiday' }),
  actionAdded: event('ActionAdded', {
    action: 'A1',
    text: 'Check school dates',
    owner: 'human',
  }),
  actionDone: event('ActionDone', { action: 'A1' }),
  actionCancelled: event('ActionCancelled', { action: 'A1' }),
  actionExported: event('ActionExported', { action: 'A1', ref: 'handoff' }),
  goalAchieved: event('GoalAchieved', { goal: 'G', agreement: 'yes, done' }),
  goalFailed: event('GoalFailed', {
    goal: 'G',
    agreement: 'give up',
    reason: 'nowhere meets every criterion',
  }),
  goalCancelled: event('GoalCancelled', { goal: 'G', agreement: 'drop it' }),
  handoffWritten: event('HandoffWritten', {
    next: 'Book the flights',
    decisions: [],
    references: [],
  }),
  sessionClosed: event('SessionClosed', { via: 'clear' }),

  openGoal: command('OpenGoal', { text: 'Pick a holiday' }),
  addAction: command('AddAction', {
    text: 'Check school dates',
    owner: 'human',
  }),
  completeAction: command('CompleteAction', { action: 'A1' }),
  cancelAction: command('CancelAction', { action: 'A1' }),
  exportAction: command('ExportAction', { action: 'A1', ref: 'handoff' }),
  closeGoal: command('CloseGoal', { as: 'achieved', agreement: 'yes, done' }),
  // Scenarios of closeGoal, matching goalFailed's and goalCancelled's words.
  failGoal: command('CloseGoal', {
    as: 'failed',
    agreement: 'give up',
    reason: 'nowhere meets every criterion',
  }),
  cancelGoal: command('CloseGoal', { as: 'cancelled', agreement: 'drop it' }),
  writeHandoff: command('WriteHandoff', {
    next: 'Book the flights',
    decisions: [],
    references: [],
  }),
  closeSession: command('CloseSession', { via: 'clear' }),
}
