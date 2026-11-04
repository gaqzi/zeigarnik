import { atom, type EngineInterface, read, update } from 'claude-code'

import type { Command } from '../core/commands.ts'
import { config, unreadableConfig } from '../core/config.ts'
import { decide, type Refusal } from '../core/decide.ts'
import type { Event } from '../core/events.ts'
import { fold, type State } from '../core/evolve.ts'
import { meter } from '../core/meter.ts'
import { overview } from '../core/overview.ts'
import { replyStart } from '../core/reply-start.ts'
import { load, save, trace } from '../storage/log.ts'

// What zg's hooks share. `run` is one command through the core: load
// the session's log, decide, then append the events and redraw the pane, or
// trace the refusal (docs/design.md). `select` is deliberately not a command:
// the selection is view state, so it appends nothing to the log.
// Function declarations: past an import, the engine follows `$` only into
// those.

const pane = atom({ plugin: 'zg', key: 'lines' } as const, [])
const selection = atom({ plugin: 'zg', key: 'selected' } as const, '')

export async function now($: EngineInterface) {
  return new Date(await $.clock.now()).toISOString()
}

export async function show($: EngineInterface, state: State) {
  await update($, pane, () => overview(state))
}

// Selecting is view state: it records nothing and asks for no focus. A second
// press on the selected item clears the selection.
export async function select($: EngineInterface, id: string) {
  const selected = await read($, selection)
  await update($, selection, () => (selected === id ? '' : id))
}

// Pressing a waiting ID shows the thread and starts a reply to it. The result
// of fill is ignored on purpose: a pane press has nobody to report a failure
// to.
export async function startReply($: EngineInterface, id: string) {
  await update($, selection, () => id)
  const { text } = await $.prompt.read()
  const add = replyStart(text, id)
  if (add !== '') await $.prompt.fill({ text: add, mode: 'append' })
}

export async function current($: EngineInterface, sessionId: string) {
  return fold(await load($, sessionId))
}

export async function run(
  $: EngineInterface,
  sessionId: string,
  command: Command,
): Promise<{ events: Event[]; state: State } | { refusal: Refusal }> {
  const events = await load($, sessionId)
  const decided = decide(fold(events), command)
  if ('refusal' in decided) {
    await trace($, sessionId, {
      type: 'CommandRefused',
      at: command.at,
      command,
      ...decided.refusal,
    })
    return decided
  }
  const all = [...events, ...decided.events]
  await save($, sessionId, all)
  const state = fold(all)
  await show($, state)

  return { events: decided.events, state }
}

// What .zg/config.json holds: its text (undefined when absent), and the
// warning about it that goes in the status line (undefined when usable).
// An unreadable file gives no text, so the defaults apply.
async function readConfig($: EngineInterface) {
  const path = '.zg/config.json'
  try {
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined

    return { text, warning: config(text).warning }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return { text: undefined, warning: unreadableConfig(message).warning }
  }
}

// Pins zg's warning under the prompt, or clears it (zg-bam.6.11). Returns the
// config text for the meter, so a prompt reads the file once.
export async function pinConfigWarning($: EngineInterface) {
  const { text, warning } = await readConfig($)
  await $.ui.status(warning)

  return text
}

// The meter line for this prompt: the session's context tokens against the
// thresholds in the config text, read afresh each prompt (zg-n27).
export async function contextMeter(
  $: EngineInterface,
  configText: string | undefined,
) {
  const { context } = await $.session.usage()

  return meter(context.tokens, configText)
}
