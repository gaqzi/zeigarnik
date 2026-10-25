import type { RegisteredToolSpec } from 'claude-code'

import type { Command } from '../core/commands.ts'
import {
  HANDOFF,
  type MoveSource,
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

const MOVE_SOURCES: MoveSource[] = ['chat', 'claude']

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
    name: 'decision',
    description:
      "Records a decision: a choice the human has to make. open one when a choice comes up, naming the choice as the title (parent: the goal, a thread or an option). option adds a candidate as it is named, numbered under the decision (D1.1). A candidate that needs exploring gets a thread under its option. A question that ends with an answer is a thread, not a decision. Dropping an option is node cancel. decide: id is the decision, option the ID of the option picked, only on the human's words: source chat or dialog, reason their words on why, verbatim, hedges included. A dialog pick alone isn't enough: ask why in chat and record those words with source chat. Never decide on your own judgment: propose and wait.",
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['open', 'option', 'decide'] },
        parent: { ...text, description: 'open: G…, T… or D…' },
        title: {
          ...text,
          description: 'open: the choice; option: the candidate',
        },
        id: { ...text, description: 'option, decide: D…' },
        option: { ...text, description: 'decide: the option picked, D….n' },
        source: { enum: SOURCES },
        reason: text,
      },
      required: ['op'],
    },
  },
  {
    name: 'node',
    description: `Acts on any node (a thread, decision or option). cancel closes it when it is no longer worth pursuing. ${CLOSED_BY} nest moves it under parent when the human says it belongs elsewhere, or when you put it in the wrong place yourself; say so in your reply. source: chat for the human's words, claude for your own correction. merge folds the from threads that turned out to be the same into the thread into, when the human says so; source and reason as for closing. reply records what is said to a node: when the human writes a line beginning with a node's ID and a colon (any case), a reply runs from it to the next such line or the message's end, paragraphs included; a range like T4–T6: gives each the same words; quoted or fenced lines are not replies. Reply author human with those words exactly, marker excluded, then author claude with your part about that node only; one of each per node per message, even when the words also close it (reply first, then close if they do). Text before the first marker is on no existing node: leave it, or open a thread for what it starts, with the text as its first human reply. move_reply moves a reply that landed on the wrong thread to thread to: ordinal is its number as show lists it, the latest when left out.`,
    inputSchema: {
      type: 'object',
      properties: {
        op: { enum: ['cancel', 'reply', 'nest', 'merge', 'move_reply'] },
        id: text,
        ordinal: { type: 'integer', description: 'move_reply: reply number' },
        to: { ...text, description: 'move_reply: T…' },
        parent: { ...text, description: 'nest: G… or T…' },
        from: {
          type: 'array',
          items: text,
          description: 'merge: T… to fold in',
        },
        into: { ...text, description: 'merge: T…' },
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
      "Shows zg's full view, or everything about one item (T4, D1, D1.2, A1).",
    inputSchema: {
      type: 'object',
      properties: {
        id: { ...text, description: 'one item, else the full view' },
      },
    },
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
    case 'decision': {
      if (input.op === 'option') {
        const id = str(input, 'id')
        if (id === undefined)
          return { missing: "option needs the id: the decision's." }
        const title = str(input, 'title')
        if (title === undefined) return { missing: 'option needs the title.' }
        return { type: 'AddOption', at, decision: id, title }
      }
      if (input.op === 'decide') {
        const id = str(input, 'id')
        if (id === undefined) return { missing: 'decide needs the id.' }
        const option = str(input, 'option')
        if (option === undefined) {
          return { missing: 'decide needs the option picked.' }
        }
        const source = sourceOf(input)
        if (source === undefined) {
          return { missing: 'decide needs source: chat or dialog.' }
        }
        const reason = str(input, 'reason')
        if (reason === undefined) {
          return {
            missing:
              "decide needs the reason: the human's words on why, verbatim; after a bare dialog pick, ask why in chat.",
          }
        }
        return {
          type: 'MakeDecision',
          at,
          decision: id,
          option,
          source,
          reason,
        }
      }
      if (input.op !== 'open') {
        return { missing: 'decision needs op: open, option or decide.' }
      }
      const parent = str(input, 'parent')
      if (parent === undefined) {
        return {
          missing:
            "open needs the parent: the goal's ID, a thread's or an option's.",
        }
      }
      const title = str(input, 'title')
      if (title === undefined) {
        return { missing: 'open needs the title: the choice to make.' }
      }
      return { type: 'OpenDecision', at, parent, title }
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
      if (input.op === 'nest') {
        const id = str(input, 'id')
        if (id === undefined) return { missing: 'nest needs the id.' }
        const parent = str(input, 'parent')
        if (parent === undefined) {
          return {
            missing: "nest needs the parent: the goal's ID or a thread's.",
          }
        }
        const source = MOVE_SOURCES.find(one => one === input.source)
        if (source === undefined) {
          return { missing: 'nest needs source: chat or claude.' }
        }
        return { type: 'NestNode', at, node: id, parent, source }
      }
      if (input.op === 'merge') {
        const named: unknown[] = Array.isArray(input.from) ? input.from : []
        if (named.length === 0) {
          return { missing: 'merge needs at least one thread to fold in.' }
        }
        const ids: string[] = []
        for (const one of named) {
          if (typeof one !== 'string' || one.trim() === '') {
            return { missing: 'merge needs from: the T… ids to fold in.' }
          }
          ids.push(one)
        }
        const from = [...new Set(ids)]
        const into = str(input, 'into')
        if (into === undefined) {
          return { missing: 'merge needs into: the thread to fold them into.' }
        }
        const source = nodeSourceOf(input)
        if (source === undefined) {
          return { missing: 'merge needs source: chat, dialog or claude.' }
        }
        const reason = str(input, 'reason')
        if (reason === undefined) {
          return {
            missing: 'merge needs the reason: the words that folded them.',
          }
        }
        return { type: 'MergeNodes', at, from, into, source, reason }
      }
      if (input.op === 'move_reply') {
        const id = str(input, 'id')
        if (id === undefined) return { missing: 'move_reply needs the id.' }
        const to = str(input, 'to')
        if (to === undefined) {
          return {
            missing: 'move_reply needs to: the thread the reply belongs on.',
          }
        }
        const { ordinal } = input
        if (
          ordinal !== undefined &&
          !(
            typeof ordinal === 'number' &&
            Number.isInteger(ordinal) &&
            ordinal >= 1
          )
        ) {
          return {
            missing:
              "move_reply needs ordinal: a reply's number as show lists it, or none for the latest.",
          }
        }
        return {
          type: 'MoveReply',
          at,
          node: id,
          ...(ordinal === undefined ? {} : { ordinal }),
          to,
        }
      }
      if (input.op !== 'cancel') {
        return {
          missing: 'node needs op: cancel, reply, nest, merge or move_reply.',
        }
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
