import type { RegisteredToolSpec } from 'claude-code'

import type { Command } from '../core/commands.ts'
import { HANDOFF } from '../core/events.ts'

// The tools Claude records the session through. Each call becomes one
// command (zg-kux); what the descriptions say reaches the model on every
// turn, so they stay inside the fixed budget (zg-n27).

export const HANDOFF_TOOL = 'handoff'
export const SHOW = 'show'

const text = { type: 'string' } as const

export const specs: RegisteredToolSpec[] = [
  {
    name: 'open',
    description:
      "Records the goal the human opened with /zg:open, in their words. origin: the tracked item's ID (bead, ticket) when they gave one.",
    inputSchema: {
      type: 'object',
      properties: { goal: text, origin: text },
      required: ['goal'],
    },
  },
  {
    name: 'action',
    description:
      "Records an action: something that must happen for the work to count as finished, not a step of yours. add one as soon as it comes up, from either side. done or cancel only when the human says so; ask why when cancelling, but don't insist. export lists it in the handoff for the human to file, or records ref where you filed it.",
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['add', 'done', 'cancel', 'export'] },
        id: { ...text, description: 'A1…, except for add' },
        text: { ...text, description: 'add: the action' },
        owner: { enum: ['human', 'claude'] },
        quote: { ...text, description: 'add: the words it came from' },
        reason: text,
        ref: text,
      },
      required: ['op'],
    },
  },
  {
    name: 'close_goal',
    description:
      'Closes the open goal once the human says how it ended: achieved, failed (with why) or cancelled. agreement: their words, verbatim.',
    inputSchema: {
      type: 'object',
      properties: {
        as: { enum: ['achieved', 'failed', 'cancelled'] },
        agreement: text,
        reason: text,
      },
      required: ['as', 'agreement'],
    },
  },
  {
    name: HANDOFF_TOOL,
    description:
      "Writes the handoff once nothing is open and returns it; call again to revise. next: the next session's one goal. decisions: what it must respect (lasting: beyond it too). references: only the few files, tickets or docs it needs.",
    inputSchema: {
      type: 'object',
      properties: {
        next: text,
        decisions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { text, lasting: { type: 'boolean' } },
            required: ['text', 'lasting'],
          },
        },
        references: { type: 'array', items: text },
      },
      required: ['next', 'decisions', 'references'],
    },
  },
  {
    name: SHOW,
    description:
      "Shows zg's full view of this session from its log: the goal, actions and handoff.",
    inputSchema: { type: 'object', properties: {} },
  },
]

type Input = Record<string, unknown>

const str = (input: Input, key: string) =>
  typeof input[key] === 'string' && input[key].trim() !== ''
    ? input[key]
    : undefined

const optional = (key: string, value: string | undefined) =>
  value === undefined ? {} : { [key]: value }

const ACTION_OPS = ['add', 'done', 'cancel', 'export']
const GOAL_ENDS = ['achieved', 'failed', 'cancelled'] as const

// The call's input as a command, or what is missing from it: the input's
// shape only, the rules are decide's. Nothing is guessed, since a guess would
// record what the human never said.
export const toCommand = (
  tool: string,
  input: Input,
  at: string,
): Command | { missing: string } => {
  switch (tool) {
    case 'open': {
      const goal = str(input, 'goal')
      if (goal === undefined) return { missing: 'open needs the goal.' }
      return {
        type: 'OpenGoal',
        at,
        text: goal,
        ...optional('origin', str(input, 'origin')),
      }
    }
    case 'action': {
      const { op } = input
      if (typeof op !== 'string' || !ACTION_OPS.includes(op)) {
        return { missing: 'action needs op: add, done, cancel or export.' }
      }
      if (op === 'add') {
        const added = str(input, 'text')
        if (added === undefined) return { missing: 'add needs the text.' }
        return {
          type: 'AddAction',
          at,
          text: added,
          owner: input.owner === 'claude' ? 'claude' : 'human',
          ...optional('quote', str(input, 'quote')),
        }
      }
      const id = str(input, 'id')
      if (id === undefined) return { missing: `${op} needs the id.` }
      if (op === 'done') return { type: 'CompleteAction', at, action: id }
      if (op === 'cancel') {
        return {
          type: 'CancelAction',
          at,
          action: id,
          ...optional('reason', str(input, 'reason')),
        }
      }
      return {
        type: 'ExportAction',
        at,
        action: id,
        ref: str(input, 'ref') ?? HANDOFF,
      }
    }
    case 'close_goal': {
      const as = GOAL_ENDS.find(end => end === input.as)
      const agreement = str(input, 'agreement')
      if (as === undefined) {
        return {
          missing: 'close_goal needs as: achieved, failed or cancelled.',
        }
      }
      if (agreement === undefined) {
        return { missing: "close_goal needs the human's words as agreement." }
      }
      return {
        type: 'CloseGoal',
        at,
        as,
        agreement,
        ...optional('reason', str(input, 'reason')),
      }
    }
    case HANDOFF_TOOL: {
      const next = str(input, 'next')
      if (next === undefined) return { missing: 'handoff needs the next goal.' }
      return {
        type: 'WriteHandoff',
        at,
        next,
        decisions: Array.isArray(input.decisions) ? input.decisions : [],
        references: Array.isArray(input.references) ? input.references : [],
      }
    }
    default:
      return { missing: `zg has no tool ${tool}.` }
  }
}
