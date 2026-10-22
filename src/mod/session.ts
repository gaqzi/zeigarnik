import { atom, type EngineInterface, update } from 'claude-code'

import type { Command } from '../core/commands.ts'
import { decide, type Refusal } from '../core/decide.ts'
import type { Event } from '../core/events.ts'
import { fold, type State } from '../core/evolve.ts'
import { overview } from '../core/overview.ts'
import { load, save, trace } from '../storage/log.ts'

// One command through the core: load the session's log, decide, then append
// the events and redraw the pane, or trace the refusal (docs/design.md).
// Function declarations: past an import, the engine follows `$` only into
// those.

const pane = atom({ plugin: 'zg', key: 'lines' } as const, [])

export async function now($: EngineInterface) {
  return new Date(await $.clock.now()).toISOString()
}

export async function show($: EngineInterface, state: State) {
  await update($, pane, () => overview(state))
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
