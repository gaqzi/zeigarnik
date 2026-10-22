import type { On, RegisteredToolSpec, UiCopyResult } from 'claude-code'

// For wiring tests: the engine beneath zg, as a test stands for it. Nothing
// sits beneath a plugin in `claude plugin test`, so these hooks answer what
// zg asks of the session: its ID, the time, files in memory, the clipboard,
// and the classic events' own (empty) results.

const SESSION = 's1'
const NOW = Date.parse('2026-10-22T10:00:00.000Z')

type Host = {
  files: Record<string, string>
  copied: string[]
  tools: RegisteredToolSpec[]
}

// The engine hands `$.fs` hooks absolute paths, resolved against the test's
// working directory; files are kept by their path inside it.
const inside = (path: string) =>
  path.includes('/.zg/') ? path.slice(path.indexOf('/.zg/') + 1) : path

export const host = (
  on: On,
  files: Record<string, string> = {},
  clipboard: UiCopyResult = { isCopied: true },
): Host => {
  const world: Host = { files: { ...files }, copied: [], tools: [] }
  on('session.id', () => ({ value: SESSION }))
  on('clock.now', () => ({ value: NOW }))
  on('fs.exists', (_, e) => ({ value: inside(e.path) in world.files }))
  on('fs.read', (_, e) => {
    const text = world.files[inside(e.path)]
    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.write', (_, e) => {
    world.files[inside(e.path)] = e.text
    return { value: undefined }
  })
  on('ui.copy', (_, e) => {
    world.copied.push(e.text)
    return { value: clipboard }
  })
  on('tool.register', (_, e) => {
    world.tools.push(e)
    return { value: { tool: `mcp__zg__${e.name}` } }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.SessionStart', () => ({}))

  return world
}

// Written out here rather than imported from storage, so an expected log is
// never derived from the code under test.
export const log = (events: readonly unknown[]) =>
  events.map(event => `${JSON.stringify(event)}\n`).join('')
