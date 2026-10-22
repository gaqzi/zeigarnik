import { expect, test } from 'claude-code/testing'

// Wiring for slice 0's skeleton. Behaviour belongs in src/core; these only
// show that the engine reaches the module's hooks.

const PANE = {
  plugin: 'zg',
  component: 'Pane',
  requestId: 'zg',
  props: {
    title: 'zg',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane says there is no goal yet, on every surface', async $ => {
  const shown: string[] = []

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    shown.push((await ui.find({ type: 'Text', text: /goal/ }))?.text ?? '')
    await ui.unmount()
  }

  expect(shown).toEqual(Array(4).fill('No goal yet.'))
})

test('show answers that there is no goal yet', async $ => {
  const ran = await $.tool.call({ tool: 'mcp__zg__show' })

  expect(ran).toMatchObject({ result: 'No goal yet.' })
})
