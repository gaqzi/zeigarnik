import type { EngineInterface } from 'claude-code'

import type { Command } from '../core/commands.ts'
import type { Refusal } from '../core/decide.ts'
import type { Event } from '../core/events.ts'

// Each session's events, one JSON object a line, in the repo (zg-r1g), and
// its refusals in a trace beside them that views ignore (zg-vgk). `$.fs`
// has no append, so a file is rewritten on every change. Function
// declarations taking `$`: the engine follows `$` across an import only into
// those, and only as `$.noun.call(...)`.

export type CommandRefused = {
  type: 'CommandRefused'
  at: string
  command: Command
} & Refusal

const logPath = (sessionId: string) => `.zg/sessions/${sessionId}.jsonl`

const tracePath = (sessionId: string) =>
  `.zg/sessions/${sessionId}.refusals.jsonl`

const parse = <T>(text: string): T[] =>
  text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as T)

const lines = (rows: readonly unknown[]) =>
  rows.map(row => `${JSON.stringify(row)}\n`).join('')

async function rows<T>($: EngineInterface, path: string): Promise<T[]> {
  return (await $.fs.exists(path)) ? parse<T>(await $.fs.read(path)) : []
}

export async function load($: EngineInterface, sessionId: string) {
  return rows<Event>($, logPath(sessionId))
}

export async function save(
  $: EngineInterface,
  sessionId: string,
  events: readonly Event[],
) {
  await $.fs.write(logPath(sessionId), lines(events))
}

export async function trace(
  $: EngineInterface,
  sessionId: string,
  refused: CommandRefused,
) {
  const path = tracePath(sessionId)
  await $.fs.write(path, lines([...(await rows($, path)), refused]))
}
