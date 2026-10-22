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
  ...overrides,
})
const closeGoal = (overrides: Input = {}) => ({
  as: 'achieved',
  agreement: 'yes, done',
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
      name: 'an action cancelled, with its reason',
      tool: 'action',
      input: action({ op: 'cancel', reason: 'school decides' }),
      command: a.cancelAction({ reason: 'school decides' }),
    },
    {
      name: 'an action exported to the handoff when no ref is given',
      tool: 'action',
      input: action({ op: 'export' }),
      command: a.exportAction(),
    },
    {
      name: 'an action exported to where Claude filed it',
      tool: 'action',
      input: action({ op: 'export', ref: 'zg-x1y' }),
      command: a.exportAction({ ref: 'zg-x1y' }),
    },
    {
      name: 'a goal closed',
      tool: 'close_goal',
      input: closeGoal({ as: 'failed', reason: 'too late' }),
      command: a.closeGoal({ as: 'failed', reason: 'too late' }),
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
        name: 'a goal closed without how it ended',
        tool: 'close_goal',
        input: closeGoal({ as: 'done' }),
        missing: 'close_goal needs as: achieved, failed or cancelled.',
      },
      {
        name: "a goal closed without the human's words",
        tool: 'close_goal',
        input: closeGoal({ agreement: '' }),
        missing: "close_goal needs the human's words as agreement.",
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
