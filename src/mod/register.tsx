import type { Register } from 'claude-code'

// Slice 0's skeleton: the pane and one tool, so the wiring tests and the
// budget check have something real to measure. Slice 1 fills them in.

export const PANE = 'zg'
export const SHOW = 'show'

const EMPTY = 'No goal yet.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: SHOW,
      description: "Shows zg's view of this session: the goal and open items.",
      isDeferred: false,
    })
    void $.ui.open({ id: PANE, title: 'zg' })

    return next(e)
  })

  on('tool.call', { tool: 'mcp__zg__show' }, () => ({ result: EMPTY }))

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text dimColor>{EMPTY}</Text>
  })
}
