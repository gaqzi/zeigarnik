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
  actionDone: event('ActionDone', { action: 'A1', source: 'chat' }),
  actionCancelled: event('ActionCancelled', { action: 'A1', source: 'chat' }),
  actionExported: event('ActionExported', {
    action: 'A1',
    ref: 'handoff',
    source: 'chat',
  }),
  goalAchieved: event('GoalAchieved', { goal: 'G', source: 'chat' }),
  goalFailed: event('GoalFailed', {
    goal: 'G',
    source: 'chat',
    reason: 'nowhere meets every criterion',
  }),
  goalCancelled: event('GoalCancelled', { goal: 'G', source: 'chat' }),
  handoffWritten: event('HandoffWritten', {
    next: 'Book the flights',
    decisions: [],
    references: [],
  }),
  sessionClosed: event('SessionClosed', { via: 'clear' }),
  threadOpened: event('ThreadOpened', {
    thread: 'T1',
    parent: 'G',
    title: 'Places in Greece',
  }),
  threadResolved: event('ThreadResolved', {
    thread: 'T1',
    outcome: 'Rhodes and Crete',
    source: 'chat',
    reason: 'that covers it',
  }),
  nodeCancelled: event('NodeCancelled', {
    node: 'T1',
    source: 'chat',
    reason: 'not going to Greece',
  }),
  nodeReplied: event('NodeReplied', {
    node: 'T1',
    author: 'human',
    text: 'no, two hours with the kids is a no',
  }),
  nodeMoved: event('NodeMoved', { node: 'T5', parent: 'T2', source: 'chat' }),
  nodeMerged: event('NodeMerged', {
    from: ['T4', 'T6'],
    into: 'T5',
    source: 'chat',
    reason: 'T4–T7 are the same as T5',
  }),
  replyMoved: event('ReplyMoved', { node: 'T5', reply: AT, to: 'T3' }),
  decisionOpened: event('DecisionOpened', {
    decision: 'D1',
    parent: 'G',
    title: 'Which holiday do we book?',
  }),
  decisionMade: event('DecisionMade', {
    decision: 'D1',
    option: 'D1.3',
    source: 'chat',
    reason: 'Paphos then, the 20 min transfer settles it',
  }),
  optionAdded: event('OptionAdded', {
    option: 'D1.1',
    decision: 'D1',
    title: 'Greek village',
  }),

  criterionAdded: event('CriterionAdded', {
    criterion: 'C1',
    on: 'D1',
    text: 'Europe',
  }),
  criterionRevised: event('CriterionRevised', {
    criterion: 'C2',
    text: 'sea ≥ 20°C',
    origin: 'T5',
  }),

  openGoal: command('OpenGoal', { text: 'Pick a holiday' }),
  addAction: command('AddAction', {
    text: 'Check school dates',
    owner: 'human',
  }),
  completeAction: command('CompleteAction', { action: 'A1', source: 'chat' }),
  cancelAction: command('CancelAction', { action: 'A1', source: 'chat' }),
  exportAction: command('ExportAction', {
    action: 'A1',
    ref: 'handoff',
    source: 'chat',
  }),
  closeGoal: command('CloseGoal', { as: 'achieved', source: 'chat' }),
  // Scenarios of closeGoal, matching goalFailed's and goalCancelled's words.
  failGoal: command('CloseGoal', {
    as: 'failed',
    source: 'chat',
    reason: 'nowhere meets every criterion',
  }),
  cancelGoal: command('CloseGoal', { as: 'cancelled', source: 'chat' }),
  writeHandoff: command('WriteHandoff', {
    next: 'Book the flights',
    decisions: [],
    references: [],
  }),
  closeSession: command('CloseSession', { via: 'clear' }),
  openThread: command('OpenThread', { parent: 'G', title: 'Places in Greece' }),
  resolveThread: command('ResolveThread', {
    thread: 'T1',
    outcome: 'Rhodes and Crete',
    source: 'chat',
    reason: 'that covers it',
  }),
  cancelNode: command('CancelNode', {
    node: 'T1',
    source: 'chat',
    reason: 'not going to Greece',
  }),
  replyToNode: command('ReplyToNode', {
    node: 'T1',
    author: 'human',
    text: 'no, two hours with the kids is a no',
  }),
  nestNode: command('NestNode', { node: 'T5', parent: 'T2', source: 'chat' }),
  mergeNodes: command('MergeNodes', {
    from: ['T4', 'T6'],
    into: 'T5',
    source: 'chat',
    reason: 'T4–T7 are the same as T5',
  }),
  moveReply: command('MoveReply', { node: 'T5', to: 'T3' }),
  openDecision: command('OpenDecision', {
    parent: 'G',
    title: 'Which holiday do we book?',
  }),
  addOption: command('AddOption', { decision: 'D1', title: 'Greek village' }),
  makeDecision: command('MakeDecision', {
    decision: 'D1',
    option: 'D1.3',
    source: 'chat',
    reason: 'Paphos then, the 20 min transfer settles it',
  }),
  recordDecision: command('RecordDecision', {
    parent: 'G',
    title: 'Which holiday do we book?',
    choice: 'Greek village',
    source: 'chat',
    reason: 'Paphos then, the 20 min transfer settles it',
  }),
  addCriterion: command('AddCriterion', { on: 'D1', text: 'Europe' }),
  reviseCriterion: command('ReviseCriterion', {
    id: 'C2',
    text: 'sea ≥ 20°C',
    origin: 'T5',
  }),
}
