import { atom, read, type Register, update } from 'claude-code'

import { brief } from '../core/brief.ts'
import { details } from '../core/details.ts'
import { handoff } from '../core/handoff.ts'
import { fullView } from '../core/overview.ts'
import { replyRows } from '../core/reply-rows.ts'
import { title } from '../core/title.ts'
import { turnIndex } from '../core/turn-index.ts'
import { current, now, run, select, show } from './session.ts'
import { HANDOFF_TOOL, SHOW, specs, toCommand } from './tools.ts'

// Hooks only: each turns its input into a core command or a view, and
// passes a refusal back to whoever sent it (zg-su8).

const PANE = 'zg'
const COPY = 'zg:copy-handoff'

const OPENING = /^\/zg:open\s+(\S[\s\S]*)$/
const titled = { plugin: 'zg', key: 'titled' } as const
// The scan reads a state reference only from a const in the file using it.
const pane = atom({ plugin: 'zg', key: 'lines' } as const, [])
const selection = atom({ plugin: 'zg', key: 'selected' } as const, '')

// zg-n27: every prompt, slash commands included, brings the index of what is
// open.
const withIndex = <R extends { additionalContext?: string[] }>(
  result: R,
  index: string | undefined,
): R =>
  index === undefined
    ? result
    : {
        ...result,
        additionalContext: [...(result.additionalContext ?? []), index],
      }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const spec of specs) {
      await $.tool.register({ ...spec, isDeferred: false })
    }
    await update($, selection, () => '')
    await show($, await current($, await $.session.id()))
    void $.ui.open({ id: PANE, title: 'zg' })

    return next(e)
  })

  on('tool.call', { tool: `mcp__zg__${SHOW}` }, async ($, e) => {
    const state = await current($, await $.session.id())
    if (typeof e.id !== 'string' || e.id.trim() === '') {
      return { result: fullView(state) }
    }
    const lines = details(state, e.id.trim())

    return {
      result:
        lines.length === 0
          ? `There is no item ${e.id.trim()}.`
          : lines.map(line => line.text).join('\n'),
    }
  })

  on('tool.call', { tool: /^mcp__zg__/ }, async ($, e) => {
    const tool = e.tool.replace('mcp__zg__', '')
    const command = toCommand(tool, e, await now($))
    if ('missing' in command) return { deny: command.missing }
    const ran = await run($, await $.session.id(), command)
    if ('refusal' in ran) {
      return { deny: `${ran.refusal.reason} ${ran.refusal.fix}` }
    }
    if (tool === HANDOFF_TOOL) {
      return {
        result: `${handoff(ran.state)}\n\nShow the human this handoff verbatim. /zg:copy-handoff copies it, to paste after /clear.`,
      }
    }

    return {
      result: ran.events
        .map(event =>
          [
            event.type,
            'goal' in event ? event.goal : '',
            'action' in event ? event.action : '',
            'thread' in event ? event.thread : '',
            'option' in event && event.type !== 'DecisionMade'
              ? event.option
              : 'decision' in event
                ? event.decision
                : '',
            'criterion' in event ? event.criterion : '',
            'node' in event ? event.node : '',
            'into' in event ? event.into : '',
          ]
            .filter(part => part !== '')
            .join(' '),
        )
        .join(', '),
    }
  })

  // /zg:open is a prompt command, so the typed line reaches this hook: the
  // one place a plugin can rename the session (see zg-bam.2's comments).
  // Once Claude has recorded the goal's origin, the next prompt adds it.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const state = await current($, await $.session.id())
    const result = withIndex(await next(e), turnIndex(state))
    const opening = OPENING.exec(e.prompt.trim())
    if (opening?.[1] !== undefined) {
      return { ...result, sessionTitle: title(opening[1]) }
    }
    const goal = state.goals.find(one => one.status === 'open')
    const { value } = await $.state.get(titled)
    if (goal?.origin === undefined || value === goal.id) return result
    await $.state.set(titled, goal.id)

    return { ...result, sessionTitle: title(goal.text, goal.origin) }
  })

  // zg-zo2: after a compaction or a resume the goal is back in context.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    if (e.source !== 'compact' && e.source !== 'resume') return result
    const short = brief(await current($, await $.session.id()))

    return short === undefined
      ? result
      : {
          ...result,
          additionalContext: [...(result.additionalContext ?? []), short],
        }
  })

  // zg-bam.15: T at the start of a line offers the open threads to answer.
  on('prompt.autocomplete', { token: /^[Tt]\d*$/ }, async ($, e, next) => ({
    suggestions: [
      ...(await next(e)).suggestions,
      ...replyRows(
        await current($, await $.session.id()),
        e.text,
        e.cursor,
        e.token,
      ),
    ],
  }))

  // A /clear after the handoff is how a session ends; a refusal (no handoff
  // stands) is only traced, as nobody is left to tell.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      // After a /clear the process goes on under a new session id without a
      // session.start, so the selection is cleared here as well.
      await update($, selection, () => '')
      const state = await current($, e.sessionId)
      if (state.goals.length > 0) {
        await run($, e.sessionId, {
          type: 'CloseSession',
          at: await now($),
          via: 'clear',
        })
      }
    }

    return next(e)
  })

  on('command.run', { command: COPY }, async $ => {
    const text = handoff(await current($, await $.session.id()))
    if (text === '') {
      return {
        text: 'No handoff yet: /zg:close closes the goal and writes it.',
      }
    }
    const copied = await $.ui.copy({ text })

    return {
      text: copied.isCopied
        ? 'Copied the handoff: /clear, then paste it.'
        : `Couldn't copy the handoff (${copied.reason}). Here it is:\n\n${text}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const lines = await read($, pane)
    const selected = await read($, selection)
    // The details stay current because every command's show writes the pane
    // atom this render reads.
    const shown =
      selected === ''
        ? []
        : details(await current($, await $.session.id()), selected)

    return (
      <Box flexDirection="column">
        {lines.map(({ item, text, isOpen }) =>
          item === undefined ? (
            <Text dimColor={!isOpen}>{text}</Text>
          ) : (
            <Button key={item} plain onPress={() => select($, item)}>
              <Text dimColor={!isOpen}>{text}</Text>
            </Button>
          ),
        )}
        {shown.length === 0 ? null : <Text>{''}</Text>}
        {shown.map(line => (
          <Text dimColor={!line.isOpen}>{line.text}</Text>
        ))}
      </Box>
    )
  })
}
