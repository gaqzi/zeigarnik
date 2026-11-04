import { describe, expect, test } from 'claude-code/testing'

import { AT, a } from '../core/a.ts'
import type { Command } from '../core/commands.ts'
import { specs, toCommand } from './tools.ts'

// A pure function in the mod: a tool call's input to the command it records,
// or what is missing from it. It runs with the wiring tests, but needs no
// engine.

type Input = Record<string, unknown>

const open = (overrides: Input = {}) => ({
  goal: 'Pick a holiday',
  ...overrides,
})
const action = (overrides: Input = {}) => ({
  op: 'done',
  id: 'A1',
  source: 'chat',
  ...overrides,
})
const thread = (overrides: Input = {}) => ({
  op: 'add',
  parent: 'G',
  title: 'Places in Greece',
  ...overrides,
})
const resolve = (overrides: Input = {}) => ({
  op: 'resolve',
  id: 'T1',
  outcome: 'Rhodes and Crete',
  source: 'chat',
  reason: 'that covers it',
  ...overrides,
})
const cancel = (overrides: Input = {}) => ({
  op: 'cancel',
  id: 'T1',
  source: 'chat',
  reason: 'not going to Greece',
  ...overrides,
})
const reply = (overrides: Input = {}) => ({
  op: 'reply',
  id: 'T1',
  author: 'human',
  text: 'no, two hours with the kids is a no',
  ...overrides,
})
const nest = (overrides: Input = {}) => ({
  op: 'nest',
  id: 'T5',
  parent: 'T2',
  source: 'chat',
  ...overrides,
})
const merge = (overrides: Input = {}) => ({
  op: 'merge',
  from: ['T4', 'T6'],
  into: 'T5',
  source: 'chat',
  reason: 'T4–T7 are the same as T5',
  ...overrides,
})
const moveReply = (overrides: Input = {}) => ({
  op: 'move_reply',
  id: 'T5',
  to: 'T3',
  ...overrides,
})
const decisionOpen = (overrides: Input = {}) => ({
  op: 'open',
  parent: 'G',
  title: 'Which holiday do we book?',
  ...overrides,
})
const decisionOption = (overrides: Input = {}) => ({
  op: 'option',
  id: 'D1',
  title: 'Greek village',
  ...overrides,
})
const closeGoal = (overrides: Input = {}) => ({
  as: 'achieved',
  source: 'chat',
  ...overrides,
})
const handoff = (overrides: Input = {}) => ({
  next: 'Book the flights',
  decisions: [],
  references: [],
  ...overrides,
})

describe('a tool call becomes', () => {
  const cases: {
    name: string
    tool: string
    input: Input
    command: Command
  }[] = [
    {
      name: 'a goal opened',
      tool: 'open',
      input: open(),
      command: a.openGoal(),
    },
    {
      name: 'a goal opened from its origin',
      tool: 'open',
      input: open({ origin: 'zg-abc' }),
      command: a.openGoal({ origin: 'zg-abc' }),
    },
    {
      name: "an action added, the human's by default",
      tool: 'action',
      input: action({ op: 'add', text: 'Check school dates' }),
      command: a.addAction(),
    },
    {
      name: 'an action added for Claude, with the words it came from',
      tool: 'action',
      input: action({
        op: 'add',
        text: 'Check school dates',
        owner: 'claude',
        quote: 'can you check',
      }),
      command: a.addAction({ owner: 'claude', quote: 'can you check' }),
    },
    {
      name: 'an action completed',
      tool: 'action',
      input: action(),
      command: a.completeAction(),
    },
    {
      name: 'an action completed from a dialog pick, with no reason',
      tool: 'action',
      input: action({ source: 'dialog' }),
      command: a.completeAction({ source: 'dialog' }),
    },
    {
      name: 'an action completed in chat, with the human’s words as the reason',
      tool: 'action',
      input: action({ reason: 'shipped' }),
      command: a.completeAction({ reason: 'shipped' }),
    },
    {
      name: 'an action completed, a blank reason counting as none',
      tool: 'action',
      input: action({ reason: '  ' }),
      command: a.completeAction(),
    },
    {
      name: 'an action cancelled, with its source and reason',
      tool: 'action',
      input: action({ op: 'cancel', source: 'dialog', reason: 'moot' }),
      command: a.cancelAction({ source: 'dialog', reason: 'moot' }),
    },
    {
      name: 'an action exported to the handoff when no ref is given',
      tool: 'action',
      input: action({ op: 'export' }),
      command: a.exportAction(),
    },
    {
      name: 'an action exported to the handoff from a dialog pick',
      tool: 'action',
      input: action({ op: 'export', source: 'dialog' }),
      command: a.exportAction({ source: 'dialog' }),
    },
    {
      name: 'an action exported to where Claude filed it',
      tool: 'action',
      input: action({ op: 'export', ref: 'zg-x1y' }),
      command: a.exportAction({ ref: 'zg-x1y' }),
    },
    {
      name: 'a thread opened under its parent',
      tool: 'thread',
      input: thread(),
      command: a.openThread(),
    },
    {
      name: 'a decision opened under its parent',
      tool: 'decision',
      input: decisionOpen(),
      command: a.openDecision(),
    },
    {
      name: 'a decision opened under an option',
      tool: 'decision',
      input: decisionOpen({ parent: 'D1.2' }),
      command: a.openDecision({ parent: 'D1.2' }),
    },
    {
      name: 'an option added to a decision',
      tool: 'decision',
      input: decisionOption(),
      command: a.addOption(),
    },
    {
      name: 'a thread resolved with its outcome',
      tool: 'thread',
      input: resolve(),
      command: a.resolveThread(),
    },
    {
      name: 'a thread resolved on Claude’s own word',
      tool: 'thread',
      input: resolve({ source: 'claude' }),
      command: a.resolveThread({ source: 'claude' }),
    },
    {
      name: 'a thread resolved with a blank outcome, left for decide to refuse',
      tool: 'thread',
      input: resolve({ outcome: ' ' }),
      command: a.resolveThread({ outcome: undefined }),
    },
    {
      name: 'a thread resolved with the outcome key absent, left for decide to refuse',
      tool: 'thread',
      input: resolve({ outcome: undefined }),
      command: a.resolveThread({ outcome: undefined }),
    },
    {
      name: 'a node cancelled with the words that closed it',
      tool: 'node',
      input: cancel(),
      command: a.cancelNode(),
    },
    {
      name: 'a node cancelled on Claude’s own word',
      tool: 'node',
      input: cancel({ source: 'claude' }),
      command: a.cancelNode({ source: 'claude' }),
    },
    {
      name: 'a thread nested under another on the human’s word',
      tool: 'node',
      input: nest(),
      command: a.nestNode(),
    },
    {
      name: 'a thread nested under the goal on Claude’s own word',
      tool: 'node',
      input: nest({ parent: 'G', source: 'claude' }),
      command: a.nestNode({ parent: 'G', source: 'claude' }),
    },
    {
      name: 'threads merged into another on the human’s word',
      tool: 'node',
      input: merge(),
      command: a.mergeNodes(),
    },
    {
      name: 'threads merged into another on Claude’s own word',
      tool: 'node',
      input: merge({ from: ['T6'], source: 'claude' }),
      command: a.mergeNodes({ from: ['T6'], source: 'claude' }),
    },
    {
      name: 'threads merged, a thread named twice folded in once, in the order named',
      tool: 'node',
      input: merge({ from: ['T6', 'T4', 'T6'] }),
      command: a.mergeNodes({ from: ['T6', 'T4'] }),
    },
    {
      name: 'the latest reply moved to another thread when no ordinal is given',
      tool: 'node',
      input: moveReply(),
      command: a.moveReply(),
    },
    {
      name: 'a reply moved by its ordinal as show lists it',
      tool: 'node',
      input: moveReply({ ordinal: 2 }),
      command: a.moveReply({ ordinal: 2 }),
    },
    {
      name: 'a reply with its author and text',
      tool: 'node',
      input: reply(),
      command: a.replyToNode(),
    },
    {
      name: 'a reply by Claude, its text kept untrimmed',
      tool: 'node',
      input: reply({ author: 'claude', text: '  Noted: transfers\n ' }),
      command: a.replyToNode({
        author: 'claude',
        text: '  Noted: transfers\n ',
      }),
    },
    {
      name: 'a goal closed from a dialog pick, with no reason',
      tool: 'close_goal',
      input: closeGoal({ source: 'dialog' }),
      command: a.closeGoal({ source: 'dialog' }),
    },
    {
      name: 'a goal closed from a dialog note, which is the reason',
      tool: 'close_goal',
      input: closeGoal({ source: 'dialog', reason: 'good enough' }),
      command: a.closeGoal({ source: 'dialog', reason: 'good enough' }),
    },
    {
      name: 'a goal closed with the words typed in chat',
      tool: 'close_goal',
      input: closeGoal({ as: 'cancelled', reason: 'Cancel it' }),
      command: a.cancelGoal({ reason: 'Cancel it' }),
    },
    {
      name: 'a goal failed with why',
      tool: 'close_goal',
      input: closeGoal({ as: 'failed', reason: 'no venue fits' }),
      command: a.failGoal({ reason: 'no venue fits' }),
    },
    {
      name: 'a handoff written',
      tool: 'handoff',
      input: handoff(),
      command: a.writeHandoff(),
    },
  ]
  for (const { name, tool, input, command } of cases) {
    test(name, () => {
      expect(toCommand(tool, input, AT)).toEqual(command)
    })
  }
})

// toCommand only reads the call's shape; decide holds the rule. These pin that
// dotted IDs pass through untouched, so decide sees them as they were named.
describe('one parent: nest and merge carry dotted IDs through', () => {
  const cases: { name: string; input: Input; command: Command }[] = [
    {
      name: 'an option nested under a thread',
      input: nest({ id: 'D1.1', parent: 'T2' }),
      command: a.nestNode({ node: 'D1.1', parent: 'T2' }),
    },
    {
      name: 'an option nested under another option',
      input: nest({ id: 'D1.1', parent: 'D1.2' }),
      command: a.nestNode({ node: 'D1.1', parent: 'D1.2' }),
    },
    {
      name: 'an option merged into an option of another decision',
      input: merge({ from: ['D1.1'], into: 'D3.1' }),
      command: a.mergeNodes({ from: ['D1.1'], into: 'D3.1' }),
    },
    {
      name: 'a decision merged into another decision',
      input: merge({ from: ['D1'], into: 'D3' }),
      command: a.mergeNodes({ from: ['D1'], into: 'D3' }),
    },
  ]
  for (const { name, input, command } of cases) {
    test(name, () => {
      expect(toCommand('node', input, AT)).toEqual(command)
    })
  }
})

describe('a tool call missing what it needs is refused', () => {
  const cases: { name: string; tool: string; input: Input; missing: string }[] =
    [
      {
        name: 'a goal without its text',
        tool: 'open',
        input: open({ goal: ' ' }),
        missing: 'open needs the goal.',
      },
      {
        name: 'an action op zg has no name for',
        tool: 'action',
        input: action({ op: 'finish' }),
        missing: 'action needs op: add, done, cancel or export.',
      },
      {
        name: 'an action added without its text',
        tool: 'action',
        input: action({ op: 'add' }),
        missing: 'add needs the text.',
      },
      {
        name: 'an action closed without its id',
        tool: 'action',
        input: action({ id: undefined }),
        missing: 'done needs the id.',
      },
      {
        name: 'a thread op zg has no name for',
        tool: 'thread',
        input: thread({ op: undefined }),
        missing: 'thread needs op: add or resolve.',
      },
      {
        name: 'a thread resolved without its id',
        tool: 'thread',
        input: resolve({ id: undefined }),
        missing: 'resolve needs the id.',
      },
      {
        name: 'a thread resolved without the words that closed it',
        tool: 'thread',
        input: resolve({ reason: undefined }),
        missing: 'resolve needs the reason: the words that closed it.',
      },
      {
        name: 'a node op zg has no name for',
        tool: 'node',
        input: cancel({ op: 'archive' }),
        missing: 'node needs op: cancel, reply, nest, merge or move_reply.',
      },
      {
        name: 'a merge without the words that folded the threads',
        tool: 'node',
        input: merge({ reason: undefined }),
        missing: 'merge needs the reason: the words that folded them.',
      },
      {
        name: 'a merge with nothing to fold in',
        tool: 'node',
        input: merge({ from: [] }),
        missing: 'merge needs at least one thread to fold in.',
      },
      {
        name: 'a merge whose from holds something that is not a thread id',
        tool: 'node',
        input: merge({ from: ['T4', 6] }),
        missing: 'merge needs from: the T… ids to fold in.',
      },
      {
        name: 'a merge whose from holds a blank id',
        tool: 'node',
        input: merge({ from: ['T4', ' '] }),
        missing: 'merge needs from: the T… ids to fold in.',
      },
      {
        name: 'a merge without the thread to fold them into',
        tool: 'node',
        input: merge({ into: undefined }),
        missing: 'merge needs into: the thread to fold them into.',
      },
      {
        name: 'a move_reply without its id',
        tool: 'node',
        input: moveReply({ id: undefined }),
        missing: 'move_reply needs the id.',
      },
      {
        name: 'a move_reply without the thread to move to',
        tool: 'node',
        input: moveReply({ to: undefined }),
        missing: 'move_reply needs to: the thread the reply belongs on.',
      },
      {
        name: 'a move_reply whose ordinal is zero',
        tool: 'node',
        input: moveReply({ ordinal: 0 }),
        missing:
          "move_reply needs ordinal: a reply's number as show lists it, or none for the latest.",
      },
      {
        name: 'a move_reply whose ordinal is not a whole number',
        tool: 'node',
        input: moveReply({ ordinal: 1.5 }),
        missing:
          "move_reply needs ordinal: a reply's number as show lists it, or none for the latest.",
      },
      {
        name: 'a move_reply whose ordinal is a word',
        tool: 'node',
        input: moveReply({ ordinal: 'last' }),
        missing:
          "move_reply needs ordinal: a reply's number as show lists it, or none for the latest.",
      },
      {
        name: 'a nest without its id',
        tool: 'node',
        input: nest({ id: undefined }),
        missing: 'nest needs the id.',
      },
      {
        name: 'a nest without its parent',
        tool: 'node',
        input: nest({ parent: undefined }),
        missing: "nest needs the parent: the goal's ID or a thread's.",
      },
      {
        name: 'a reply without its id',
        tool: 'node',
        input: reply({ id: undefined }),
        missing: 'reply needs the id.',
      },
      {
        name: 'a reply without its author',
        tool: 'node',
        input: reply({ author: undefined }),
        missing: 'reply needs author: human or claude.',
      },
      {
        name: 'a reply whose author is neither human nor claude',
        tool: 'node',
        input: reply({ author: 'dialog' }),
        missing: 'reply needs author: human or claude.',
      },
      {
        name: 'a reply without its text',
        tool: 'node',
        input: reply({ text: undefined }),
        missing: 'reply needs the text.',
      },
      {
        name: 'a reply whose text is blank',
        tool: 'node',
        input: reply({ text: '  ' }),
        missing: 'reply needs the text.',
      },
      {
        name: 'a reply missing both id and author names the id first',
        tool: 'node',
        input: reply({ id: undefined, author: undefined }),
        missing: 'reply needs the id.',
      },
      {
        name: 'a node cancelled without its id',
        tool: 'node',
        input: cancel({ id: undefined }),
        missing: 'cancel needs the id.',
      },
      {
        name: 'a node cancelled from a dialog without the words that closed it',
        tool: 'node',
        input: cancel({ source: 'dialog', reason: undefined }),
        missing: 'cancel needs the reason: the words that closed it.',
      },
      {
        name: 'a thread added without its parent',
        tool: 'thread',
        input: thread({ parent: ' ' }),
        missing: "add needs the parent: the goal's ID or a thread's.",
      },
      {
        name: 'a thread added without its title',
        tool: 'thread',
        input: thread({ title: undefined }),
        missing: 'add needs the title.',
      },
      {
        name: 'a decision call with no op zg has a name for',
        tool: 'decision',
        input: decisionOpen({ op: 'drop' }),
        missing: 'decision needs op: open, option or decide.',
      },
      {
        name: 'a decision call with op record is refused like any unknown op',
        tool: 'decision',
        input: decisionOpen({ op: 'record' }),
        missing: 'decision needs op: open, option or decide.',
      },
      {
        name: 'a decision opened without its parent',
        tool: 'decision',
        input: decisionOpen({ parent: ' ' }),
        missing:
          "open needs the parent: the goal's ID, a thread's or an option's.",
      },
      {
        name: 'a decision opened without the choice to make',
        tool: 'decision',
        input: decisionOpen({ title: undefined }),
        missing: 'open needs the title: the choice to make.',
      },
      {
        name: 'a decision opened with a blank title',
        tool: 'decision',
        input: decisionOpen({ title: '  ' }),
        missing: 'open needs the title: the choice to make.',
      },
      {
        name: 'an option added without its decision',
        tool: 'decision',
        input: decisionOption({ id: undefined }),
        missing: "option needs the id: the decision's.",
      },
      {
        name: 'an option added without its title',
        tool: 'decision',
        input: decisionOption({ title: undefined }),
        missing: 'option needs the title.',
      },
      {
        name: 'a goal closed without how it ended',
        tool: 'close_goal',
        input: closeGoal({ as: 'done' }),
        missing: 'close_goal needs as: achieved, failed or cancelled.',
      },
      {
        name: 'a handoff without the next goal',
        tool: 'handoff',
        input: handoff({ next: '' }),
        missing: 'handoff needs the next goal.',
      },
      {
        name: 'a tool zg does not have',
        tool: 'merge',
        input: {},
        missing: 'zg has no tool merge.',
      },
    ]
  for (const { name, tool, input, missing } of cases) {
    test(name, () => {
      expect(toCommand(tool, input, AT)).toEqual({ missing })
    })
  }
})

describe('a tool call whose source is absent or not chat or dialog is refused', () => {
  const calls: {
    name: string
    tool: string
    input: (source: unknown) => Input
    missing: string
  }[] = [
    {
      name: 'a goal closed',
      tool: 'close_goal',
      input: source => closeGoal({ source }),
      missing: 'close_goal needs source: chat or dialog.',
    },
    {
      name: 'an action done',
      tool: 'action',
      input: source => action({ op: 'done', source }),
      missing: 'done needs source: chat or dialog.',
    },
    {
      name: 'an action cancelled',
      tool: 'action',
      input: source => action({ op: 'cancel', source }),
      missing: 'cancel needs source: chat or dialog.',
    },
    {
      name: 'an action exported',
      tool: 'action',
      input: source => action({ op: 'export', source }),
      missing: 'export needs source: chat or dialog.',
    },
  ]
  const sources = [
    { how: 'absent', source: undefined },
    { how: 'pane', source: 'pane' },
  ]
  for (const { name, tool, input, missing } of calls) {
    for (const { how, source } of sources) {
      test(`${name} with its source ${how}`, () => {
        expect(toCommand(tool, input(source), AT)).toEqual({ missing })
      })
    }
  }
})

describe('a tool call whose source is absent or not chat or claude is refused', () => {
  const sources = [
    { how: 'absent', source: undefined },
    { how: 'dialog', source: 'dialog' },
    { how: 'human', source: 'human' },
  ]
  for (const { how, source } of sources) {
    test(`a thread nested with its source ${how}`, () => {
      expect(toCommand('node', nest({ source }), AT)).toEqual({
        missing: 'nest needs source: chat or claude.',
      })
    })
  }
})

describe('a tool call whose source is absent or not chat, dialog or claude is refused', () => {
  const calls: {
    name: string
    tool: string
    input: (source: unknown) => Input
    missing: string
  }[] = [
    {
      name: 'a thread resolved',
      tool: 'thread',
      input: source => resolve({ source }),
      missing: 'resolve needs source: chat, dialog or claude.',
    },
    {
      name: 'a node cancelled',
      tool: 'node',
      input: source => cancel({ source }),
      missing: 'cancel needs source: chat, dialog or claude.',
    },
    {
      name: 'threads merged',
      tool: 'node',
      input: source => merge({ source }),
      missing: 'merge needs source: chat, dialog or claude.',
    },
  ]
  const sources = [
    { how: 'absent', source: undefined },
    { how: 'human', source: 'human' },
  ]
  for (const { name, tool, input, missing } of calls) {
    for (const { how, source } of sources) {
      test(`${name} with its source ${how}`, () => {
        expect(toCommand(tool, input(source), AT)).toEqual({ missing })
      })
    }
  }
})

describe('a decision decided', () => {
  const decide = (overrides: Input = {}) => ({
    op: 'decide',
    id: 'D1',
    option: 'D1.3',
    source: 'chat',
    reason: 'Paphos then, the 20 min transfer settles it',
    ...overrides,
  })

  test('is the pick, its source and the human’s words as the command', () => {
    expect(toCommand('decision', decide(), AT)).toEqual(a.makeDecision())
  })

  test('from a dialog pick keeps the words asked for in chat', () => {
    expect(toCommand('decision', decide({ source: 'dialog' }), AT)).toEqual(
      a.makeDecision({ source: 'dialog' }),
    )
  })

  test('with a new option’s title instead of an option is that title, its source and the words as the command', () => {
    expect(
      toCommand('decision', decide({ option: undefined, title: 'Rhodes' }), AT),
    ).toEqual(a.pickNewOption())
  })

  const reasonMissing =
    "decide needs the reason: the human's words on why, verbatim; after a bare dialog pick, ask why in chat."
  const missing: {
    name: string
    input: Input
    missing: string
  }[] = [
    {
      name: 'a dialog pick with no reason',
      input: decide({ source: 'dialog', reason: undefined }),
      missing: reasonMissing,
    },
    {
      name: 'a chat pick with no reason',
      input: decide({ reason: undefined }),
      missing: reasonMissing,
    },
    {
      name: 'a pick with a blank reason',
      input: decide({ reason: '  ' }),
      missing: reasonMissing,
    },
    {
      name: 'a pick with no source',
      input: decide({ source: undefined }),
      missing: 'decide needs source: chat or dialog.',
    },
    {
      name: 'a pick on Claude’s own word',
      input: decide({ source: 'claude' }),
      missing: 'decide needs source: chat or dialog.',
    },
    {
      name: 'a pick from the pane',
      input: decide({ source: 'pane' }),
      missing: 'decide needs source: chat or dialog.',
    },
    {
      name: 'a pick with neither an option nor a new option’s title',
      input: decide({ option: undefined }),
      missing: "decide needs the option picked, or a new option's title.",
    },
    {
      name: 'a new option’s title with no reason, which shares the option form’s long text',
      input: decide({ option: undefined, title: 'Rhodes', reason: undefined }),
      missing: reasonMissing,
    },
    {
      name: 'a pick with both an option and a new option’s title',
      input: decide({ title: 'Rhodes' }),
      missing: "decide takes an option or a new option's title, not both.",
    },
  ]
  for (const { name, input, missing: reason } of missing) {
    test(`${name} is refused`, () => {
      expect(toCommand('decision', input, AT)).toEqual({ missing: reason })
    })
  }
})

describe('a criterion attaches to a decision', () => {
  const add = (overrides: Input = {}) => ({
    op: 'add',
    on: 'D1',
    text: 'Europe',
    ...overrides,
  })

  test('is the decision it serves and its text as the command', () => {
    expect(toCommand('criterion', add(), AT)).toEqual(a.addCriterion())
  })

  test('keeps the node it came up in', () => {
    expect(toCommand('criterion', add({ origin: 'D2' }), AT)).toEqual(
      a.addCriterion({ origin: 'D2' }),
    )
  })

  test('with no origin carries none', () => {
    expect(toCommand('criterion', add({ origin: undefined }), AT)).toEqual({
      type: 'AddCriterion',
      at: AT,
      on: 'D1',
      text: 'Europe',
    })
  })

  const missing: { name: string; input: Input; missing: string }[] = [
    {
      name: 'a criterion with no text',
      input: add({ text: undefined }),
      missing: 'add needs the text.',
    },
    {
      name: 'a criterion with a blank text',
      input: add({ text: '  ' }),
      missing: 'add needs the text.',
    },
    {
      name: 'a criterion with no decision',
      input: add({ on: undefined }),
      missing: "add needs on: the decision's ID.",
    },
    {
      name: 'a criterion with a blank decision',
      input: add({ on: ' ' }),
      missing: "add needs on: the decision's ID.",
    },
    {
      name: 'a criterion call with no op',
      input: add({ op: undefined }),
      missing: 'criterion needs op: add or revise.',
    },
    {
      name: 'a criterion call with an op zg has no name for',
      input: add({ op: 'retire' }),
      missing: 'criterion needs op: add or revise.',
    },
  ]
  for (const { name, input, missing: reason } of missing) {
    test(`${name} is refused`, () => {
      expect(toCommand('criterion', input, AT)).toEqual({ missing: reason })
    })
  }

  test('the tool takes add with the decision, the text and the origin, and says what it is for', () => {
    const spec = specs.find(one => one.name === 'criterion')
    const properties = (
      spec?.inputSchema as { properties?: Record<string, unknown> } | undefined
    )?.properties

    expect({
      name: spec?.name,
      ops: properties?.op,
      inputs: Object.keys(properties ?? {}).sort(),
      isDescribed: (spec?.description ?? '') !== '',
    }).toEqual({
      name: 'criterion',
      ops: { enum: ['add', 'revise'] },
      inputs: ['id', 'on', 'op', 'origin', 'text'],
      isDescribed: true,
    })
  })
})

describe('a revision names what changed it', () => {
  const revise = (overrides: Input = {}) => ({
    op: 'revise',
    id: 'C2',
    text: 'sea ≥ 20°C',
    origin: 'T5',
    ...overrides,
  })

  test('is the criterion, its new text and the node that changed it as the command', () => {
    expect(toCommand('criterion', revise(), AT)).toEqual(a.reviseCriterion())
  })

  const missing: { name: string; input: Input; missing: string }[] = [
    {
      name: 'a revision with no origin',
      input: revise({ origin: undefined }),
      missing: 'revise needs origin: the node that changed it.',
    },
    {
      name: 'a revision with a blank origin',
      input: revise({ origin: ' ' }),
      missing: 'revise needs origin: the node that changed it.',
    },
    {
      name: 'a revision with no text',
      input: revise({ text: undefined }),
      missing: 'revise needs the text.',
    },
    {
      name: 'a revision with a blank text',
      input: revise({ text: '  ' }),
      missing: 'revise needs the text.',
    },
    {
      name: 'a revision with no criterion',
      input: revise({ id: undefined }),
      missing: "revise needs id: the criterion's ID.",
    },
  ]
  for (const { name, input, missing: reason } of missing) {
    test(`${name} is refused`, () => {
      expect(toCommand('criterion', input, AT)).toEqual({ missing: reason })
    })
  }
})
