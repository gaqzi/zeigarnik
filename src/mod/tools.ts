import type { RegisteredToolSpec } from 'claude-code'

import type { Command } from '../core/commands.ts'
import {
  HANDOFF,
  type NodeSource,
  type Owner,
  type Source,
} from '../core/events.ts'

// The tools Claude records the session through. Each call becomes one
// command (zg-kux); what the descriptions say reaches the model on every
// turn, so they stay inside the fixed budget (zg-n27).

export const HANDOFF_TOOL = 'handoff'
export const SHOW = 'show'

const text = { type: 'string' } as const

const SOURCES: Source[] = ['chat', 'dialog']
const OWNERS: Owner[] = ['human', 'claude']
const NODE_SOURCES: NodeSource[] = ['chat', 'dialog', 'claude']

const CLOSED_BY =
  "source: whose words closed it: chat or dialog for the human's, claude when you close it yourself. reason: those words verbatim for the human's; with claude, what let you close it yourself: the condition the human set and that it was met, or your own fan-out research reported in this reply."

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
      "Records an action: something that must happen for the work to count as finished, not a step of yours. add one as soon as it comes up, from either side. done or cancel only when the human says so; ask why when cancelling, but don't insist. source (not for add): where the human's answer came from, dialog if picked in the dialog, chat if typed. reason: whatever words they gave about how it ended, verbatim (a dialog note, or what they typed, even 'drop it'), never yours; leave it out only for a bare pick. export lists it in the handoff for the human to file, or records ref where you filed it.",
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['add', 'done', 'cancel', 'export'] },
        id: { ...text, description: 'A1…, except for add' },
        text: { ...text, description: 'add: the action' },
        owner: { enum: ['human', 'claude'] },
        quote: { ...text, description: 'add: the words it came from' },
        source: { enum: SOURCES },
        reason: text,
        ref: text,
      },
      required: ['op'],
    },
  },
  {
    name: 'thread',
    description: `Records a thread: each thing we are looking to close, such as a question or a choice, opened under the goal or the thread it came up in. add one as soon as it comes up. parent: the goal's ID or a thread's. resolve closes it with outcome: a short summary, your words are fine. ${CLOSED_BY}`,
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['add', 'resolve'] },
        parent: { ...text, description: 'add: G… or T…' },
        title: { ...text, description: 'add: the thread' },
        id: { ...text, description: 'resolve: T…' },
        outcome: text,
        source: { enum: NODE_SOURCES },
        reason: text,
      },
      required: ['op'],
    },
  },
  {
    name: 'node',
    description: `Acts on any node (a thread so far). cancel closes it when it is no longer worth pursuing. ${CLOSED_BY} When a message addresses a thread, reply: author human with their words exactly as written in their message, author claude with your own part that addresses it; one reply per thread per message.`,
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['cancel', 'reply'] },
        id: text,
        author: { enum: OWNERS },
        text: { ...text, description: 'reply: what was said' },
        source: { enum: NODE_SOURCES },
        reason: text,
      },
      required: ['op'],
    },
  },
  {
    name: 'close_goal',
    description:
      "Closes the open goal once the human says how it ended: achieved, failed (with why) or cancelled. source: where the human's answer came from, dialog if picked in the dialog, chat if typed. reason: whatever words they gave about how it ended, verbatim (a dialog note, or what they typed, even 'drop it' or 'I'd rather not say'), never yours; leave it out only for a bare pick.",
    inputSchema: {
      type: 'object',
      properties: {
        as: { enum: ['achieved', 'failed', 'cancelled'] },
        source: { enum: SOURCES },
        reason: text,
      },
      required: ['as', 'source'],
    },
  },
  {
    name: HANDOFF_TOOL,
    description:
      "Writes the handoff once nothing is open and returns it; call again to revise. Written as the human's message to the next session: 'I' is the human, 'you' is Claude. next: the next session's one goal. decisions: what it must respect (lasting: beyond it too). references: only the few files, tickets or docs it needs.",
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
      "Shows zg's full view of this session from its log: the goal, actions, threads with what was said on them, and handoff.",
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

const sourceOf = (input: Input) =>
  SOURCES.find(source => source === input.source)

const nodeSourceOf = (input: Input) =>
  NODE_SOURCES.find(source => source === input.source)

// The id, source and reason that close a node, or what is missing.
const closedBy = (
  op: string,
  input: Input,
): { id: string; source: NodeSource; reason: string } | { missing: string } => {
  const id = str(input, 'id')
  if (id === undefined) return { missing: `${op} needs the id.` }
  const source = nodeSourceOf(input)
  if (source === undefined) {
    return { missing: `${op} needs source: chat, dialog or claude.` }
  }
  const reason = str(input, 'reason')
  if (reason === undefined) {
    return { missing: `${op} needs the reason: the words that closed it.` }
  }
  return { id, source, reason }
}

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
      const source = sourceOf(input)
      if (source === undefined) {
        return { missing: `${op} needs source: chat or dialog.` }
      }
      const reason = optional('reason', str(input, 'reason'))
      if (op === 'done') {
        return { type: 'CompleteAction', at, action: id, source, ...reason }
      }
      if (op === 'cancel') {
        return { type: 'CancelAction', at, action: id, source, ...reason }
      }
      return {
        type: 'ExportAction',
        at,
        action: id,
        ref: str(input, 'ref') ?? HANDOFF,
        source,
        ...reason,
      }
    }
    case 'thread': {
      if (input.op === 'resolve') {
        const closed = closedBy('resolve', input)
        if ('missing' in closed) return closed
        return {
          type: 'ResolveThread',
          at,
          thread: closed.id,
          ...optional('outcome', str(input, 'outcome')),
          source: closed.source,
          reason: closed.reason,
        }
      }
      if (input.op !== 'add') {
        return { missing: 'thread needs op: add or resolve.' }
      }
      const parent = str(input, 'parent')
      if (parent === undefined) {
        return { missing: "add needs the parent: the goal's ID or a thread's." }
      }
      const title = str(input, 'title')
      if (title === undefined) return { missing: 'add needs the title.' }
      return { type: 'OpenThread', at, parent, title }
    }
    case 'node': {
      if (input.op === 'reply') {
        const id = str(input, 'id')
        if (id === undefined) return { missing: 'reply needs the id.' }
        const author = OWNERS.find(owner => owner === input.author)
        if (author === undefined) {
          return { missing: 'reply needs author: human or claude.' }
        }
        const said = str(input, 'text')
        if (said === undefined) return { missing: 'reply needs the text.' }
        return { type: 'ReplyToNode', at, node: id, author, text: said }
      }
      if (input.op !== 'cancel') {
        return { missing: 'node needs op: cancel or reply.' }
      }
      const closed = closedBy('cancel', input)
      if ('missing' in closed) return closed
      return {
        type: 'CancelNode',
        at,
        node: closed.id,
        source: closed.source,
        reason: closed.reason,
      }
    }
    case 'close_goal': {
      const as = GOAL_ENDS.find(end => end === input.as)
      const source = sourceOf(input)
      if (as === undefined) {
        return {
          missing: 'close_goal needs as: achieved, failed or cancelled.',
        }
      }
      if (source === undefined) {
        return { missing: 'close_goal needs source: chat or dialog.' }
      }
      return {
        type: 'CloseGoal',
        at,
        as,
        source,
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
