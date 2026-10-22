import { expect, test } from 'claude-code/testing'

import { host } from './host.ts'

// zg-n27: the fixed part of zg's context (tool schemas and standing
// instructions) stays within 3k tokens. claude plugin details can't see
// what a hooks module registers at run time, so this measures what reaches
// the model as it is registered, at about four characters a token.

const BUDGET = 3000

const tokens = (text: string) => Math.ceil(text.length / 4)

test("zg's fixed context fits its budget", async ($, on) => {
  // The host reads back the registrations: what the model is sent is the
  // measure, and nothing in the plugin's own output carries it.
  const world = host(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const fixed = world.tools
    .filter(tool => tool.isDeferred === false)
    .map(({ name, description, inputSchema }) =>
      JSON.stringify({ name, description, inputSchema }),
    )
    .join('')

  expect(tokens(fixed)).toBeLessThanOrEqual(BUDGET)
})
