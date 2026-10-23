import { describe, expect, test } from 'claude-code/testing'

import { AT, a } from '../core/a.ts'
import type { Command } from '../core/commands.ts'
import { toCommand } from './tools.ts'

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
        input: cancel({ op: 'merge' }),
        missing: 'node needs op: cancel.',
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
