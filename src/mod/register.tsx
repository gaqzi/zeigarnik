import { atom, read, type Register } from 'claude-code'

import { brief } from '../core/brief.ts'
import { handoff } from '../core/handoff.ts'
import { fullView } from '../core/overview.ts'
import { title } from '../core/title.ts'
import { current, now, run, show } from './session.ts'
import { HANDOFF_TOOL, SHOW, specs, toCommand } from './tools.ts'

// Hooks only: each turns its input into a core command or a view, and
// passes a refusal back to whoever sent it (zg-su8).

const PANE = 'zg'
const COPY = 'zg-copy-handoff'

const OPENING = /^\/zg:open\s+(\S[\s\S]*)$/
const titled = { plugin: 'zg', key: 'titled' } as const
// The scan reads a state reference only from a const in the file using it.
const pane = atom({ plugin: 'zg', key: 'lines' } as const, [])

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const spec of specs) {
      await $.tool.register({ ...spec, isDeferred: false })
    }
    await $.command.register({
      name: COPY,
      description: "Copies zg's handoff, to paste after /clear",
    })
    await show($, await current($, await $.session.id()))
    void $.ui.open({ id: PANE, title: 'zg' })

    return next(e)
  })

  on('tool.call', { tool: `mcp__zg__${SHOW}` }, async $ => ({
    result: fullView(await current($, await $.session.id())),
  }))

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
        result: `${handoff(ran.state)}\n\nShow the human this handoff verbatim. /zg-copy-handoff copies it, to paste after /clear.`,
      }
    }

    return {
      result: ran.events
        .map(event =>
          [
            event.type,
            'goal' in event ? event.goal : '',
            'action' in event ? event.action : '',
          ]
            .filter(part => part !== '')
            .join(' '),
        )
        .join('\n'),
    }
  })

  // /zg:open is a prompt command, so the typed line reaches this hook: the
  // one place a plugin can rename the session (see zg-bam.2's comments).
  // Once Claude has recorded the goal's origin, the next prompt adds it.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const result = await next(e)
    const opening = OPENING.exec(e.prompt.trim())
    if (opening?.[1] !== undefined) {
      return { ...result, sessionTitle: title(opening[1]) }
    }
    const state = await current($, await $.session.id())
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

  // A /clear after the handoff is how a session ends; a refusal (no handoff
  // stands) is only traced, as nobody is left to tell.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
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
    const { Box, Text } = $.ui.resolve(e)
    const lines = await read($, pane)

    return (
      <Box flexDirection="column">
        {lines.map(line => (
          <Text dimColor={!line.isOpen}>{line.text}</Text>
        ))}
      </Box>
    )
  })
}
