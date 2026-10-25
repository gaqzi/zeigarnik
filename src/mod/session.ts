import { atom, type EngineInterface, read, update } from 'claude-code'

import type { Command } from '../core/commands.ts'
import { decide, type Refusal } from '../core/decide.ts'
import type { Event } from '../core/events.ts'
import { fold, type State } from '../core/evolve.ts'
import { overview } from '../core/overview.ts'
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
