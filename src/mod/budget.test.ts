import type { RegisteredToolSpec } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// zg-n27: the fixed part of zg's context (tool schemas and standing
// instructions) stays within 3k tokens. claude plugin details can't see
// what a hooks module registers at run time, so this measures what reaches
// the model as it is registered, at about four characters a token.

const BUDGET = 3000

const tokens = (text: string) => Math.ceil(text.length / 4)

test("zg's fixed context fits its budget", async ($, on) => {
  const tools: RegisteredToolSpec[] = []
  // Read back the registrations: what the model is sent is the measure,
  // and nothing in the plugin's own output carries it.
  on('tool.register', (_, e) => {
    tools.push(e)
    return { value: { tool: `mcp__zg__${e.name}` } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const fixed = tools
    .filter(tool => tool.isDeferred === false)
    .map(({ name, description, inputSchema }) =>
      JSON.stringify({ name, description, inputSchema }),
    )
    .join('')

  expect(tokens(fixed)).toBeLessThanOrEqual(BUDGET)
})
