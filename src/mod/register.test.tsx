import { expect, test } from 'claude-code/testing'

import { AT, a } from '../core/a.ts'
import { host, log } from './host.ts'

// Wiring: that the engine reaches zg's hooks, and they reach the core and
// the log. One test per path; the rules themselves are tested in src/core.

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

const LOG = '.zg/sessions/s1.jsonl'
const TRACE = '.zg/sessions/s1.refusals.jsonl'
const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const

const finished = [
  a.goalOpened(),
  a.actionAdded(),
  a.actionExported(),
  a.goalAchieved(),
]

test('the pane says there is no goal yet, on every surface', async ($, on) => {
  host(on)
  await $.session.start(START)
  const shown: string[] = []

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    shown.push((await ui.find({ type: 'Text', text: /goal/ }))?.text ?? '')
    await ui.unmount()
  }

  expect(shown).toEqual(Array(4).fill('No goal yet.'))
})

test('/zg:open renames the session after the goal', async ($, on) => {
  host(on)

  const answer = await $.classic.UserPromptSubmit({
    prompt: '/zg:open Pick a holiday\nFamily wants: Europe',
  })

  expect(answer).toEqual({ sessionTitle: 'Pick a holiday' })
})

test('the next prompt adds the origin to the title, once', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened({ origin: 'zg-abc' })]) })
  const prompt = { prompt: 'go on', session_title: 'Pick a holiday' }

  const answers = [
    await $.classic.UserPromptSubmit(prompt),
    await $.classic.UserPromptSubmit(prompt),
  ]

  expect(answers).toEqual([{ sessionTitle: 'zg-abc Pick a holiday' }, {}])
})

// The kit can't list commands ($.command.list is undefined), so
// commands/copy-handoff.md is checked only by hand.
const COPY = {
  command: 'zg:copy-handoff',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

const CLEAR = {
  reason: 'clear',
  sessionId: 's1',
  resume: { id: 's1' },
} as const

const refused = {
  type: 'CommandRefused',
  at: '2026-10-22T10:00:00.000Z',
  command: a.addAction(),
  reason:
    'One parent: an action belongs to the open goal, and no goal is open.',
  fix: 'Open a goal first: the human starts one with /zg:open.',
}

test('an action recorded through a tool is logged and shows in the pane', async ($, on) => {
  const world = host(on)
  await $.session.start(START)

  const answers = [
    await $.tool.call({ tool: 'mcp__zg__open', goal: 'Pick a holiday' }),
    await $.tool.call({
      tool: 'mcp__zg__action',
      op: 'add',
      text: 'Check school dates',
    }),
  ]
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect({ answers, pane, files: world.files }).toEqual({
    answers: [{ result: 'GoalOpened G' }, { result: 'ActionAdded A1' }],
    pane: [
      '○ G Pick a holiday',
      '0 open · 0 closed',
      'Actions',
      '☐ A1 Check school dates (human)',
    ],
    files: { [LOG]: log([a.goalOpened(), a.actionAdded()]) },
  })
})

test('a thread recorded through a tool is logged and shows in the pane as a tree', async ($, on) => {
  const world = host(on)
  await $.session.start(START)

  const answers = [
    await $.tool.call({ tool: 'mcp__zg__open', goal: 'Pick a holiday' }),
    await $.tool.call({
      tool: 'mcp__zg__thread',
      op: 'add',
      parent: 'G',
      title: 'Places in Greece',
    }),
  ]
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect({ answers, pane, files: world.files }).toEqual({
    answers: [{ result: 'GoalOpened G' }, { result: 'ThreadOpened T1' }],
    pane: [
      '○ G Pick a holiday',
      '1 open · 0 closed',
      '  ○ T1 Places in Greece',
    ],
    files: { [LOG]: log([a.goalOpened(), a.threadOpened()]) },
  })
})

test('Claude resolves its own research thread with its outcome and the words that say so', async ($, on) => {
  const warm = a.threadOpened({ title: 'Which countries are warm enough?' })
  const world = host(on, { [LOG]: log([a.goalOpened(), warm]) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__thread',
    op: 'resolve',
    id: 'T1',
    outcome: 'GR, ES, CY',
    source: 'claude',
    reason: 'my research under T1, reported in this reply',
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect({ answer, pane, files: world.files }).toEqual({
    answer: { result: 'ThreadResolved T1' },
    pane: [
      { text: '○ G Pick a holiday', isDim: false },
      { text: '0 open · 1 closed', isDim: false },
      {
        text: '  ✓ T1 Which countries are warm enough? → GR, ES, CY',
        isDim: true,
      },
    ],
    files: {
      [LOG]: log([
        a.goalOpened(),
        warm,
        a.threadResolved({
          outcome: 'GR, ES, CY',
          source: 'claude',
          reason: 'my research under T1, reported in this reply',
        }),
      ]),
    },
  })
})

test("the human's words end a thread, cancelled with the reason verbatim", async ($, on) => {
  const cyprus = a.threadOpened({ thread: 'T4', title: 'Places in Cyprus' })
  const world = host(on, { [LOG]: log([a.goalOpened(), cyprus]) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__node',
    op: 'cancel',
    id: 'T4',
    source: 'chat',
    reason: 'skip Cyprus, flights are silly money',
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect({ answer, pane, files: world.files }).toEqual({
    answer: { result: 'NodeCancelled T4' },
    pane: [
      { text: '○ G Pick a holiday', isDim: false },
      { text: '0 open · 1 closed', isDim: false },
      {
        text: '  ✗ T4 Places in Cyprus · skip Cyprus, flights are silly money',
        isDim: true,
      },
    ],
    files: {
      [LOG]: log([
        a.goalOpened(),
        cyprus,
        a.nodeCancelled({
          node: 'T4',
          reason: 'skip Cyprus, flights are silly money',
        }),
      ]),
    },
  })
})

test('a thread refused for want of a goal goes back as an error and is traced', async ($, on) => {
  const world = host(on)
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__thread',
    op: 'add',
    parent: 'G',
    title: 'Places in Greece',
  })

  expect({ answer, files: world.files }).toEqual({
    answer: {
      deny: "One parent: a thread belongs to the open goal's tree, and no goal is open. Open a goal first: the human starts one with /zg:open.",
    },
    files: {
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: a.openThread(),
          reason:
            "One parent: a thread belongs to the open goal's tree, and no goal is open.",
          fix: 'Open a goal first: the human starts one with /zg:open.',
        },
      ]),
    },
  })
})

test('a refused command goes back as an error and is added to the trace', async ($, on) => {
  const world = host(on, { [TRACE]: log([refused]) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__action',
    op: 'add',
    text: 'Check school dates',
  })

  expect({ answer, files: world.files }).toEqual({
    answer: {
      deny: 'One parent: an action belongs to the open goal, and no goal is open. Open a goal first: the human starts one with /zg:open.',
    },
    files: { [TRACE]: log([refused, refused]) },
  })
})

test('a thread with open children is refused with an overview and the refusal is traced', async ($, on) => {
  const given = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T1', parent: 'G', title: 'Places' }),
    a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Places in Greece' }),
    a.threadOpened({ thread: 'T3', parent: 'T1', title: 'Places in Spain' }),
    a.threadOpened({ thread: 'T4', parent: 'T1', title: 'Places in Italy' }),
    a.threadResolved({ thread: 'T4' }),
  ]
  const world = host(on, { [LOG]: log(given) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__thread',
    op: 'resolve',
    id: 'T1',
    outcome: 'Greece or Spain',
    source: 'chat',
    reason: 'that covers it',
  })

  expect({ answer, files: world.files }).toEqual({
    answer: {
      deny: 'Children close first: T2 Places in Greece and T3 Places in Spain are still open under T1. Show the human the open children and ask how each ends, or propose one outcome that settles them for the human to confirm.',
    },
    files: {
      [LOG]: log(given),
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: a.resolveThread({ outcome: 'Greece or Spain' }),
          reason:
            'Children close first: T2 Places in Greece and T3 Places in Spain are still open under T1.',
          fix: 'Show the human the open children and ask how each ends, or propose one outcome that settles them for the human to confirm.',
        },
      ]),
    },
  })
})

test('closing the goal as achieved with a thread and an action open is refused and traced', async ($, on) => {
  const given = [a.goalOpened(), a.threadOpened(), a.actionAdded()]
  const world = host(on, { [LOG]: log(given) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__close_goal',
    as: 'achieved',
    source: 'chat',
    reason: 'we are done',
  })

  expect({ answer, files: world.files }).toEqual({
    answer: {
      deny: 'Children close first: T1 Places in Greece and A1 Check school dates are still open under G. Ask the human how each ends, or, if their words end the whole session, cancel every open item with those words, children first, then the goal.',
    },
    files: {
      [LOG]: log(given),
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: a.closeGoal({ reason: 'we are done' }),
          reason:
            'Children close first: T1 Places in Greece and A1 Check school dates are still open under G.',
          fix: 'Ask the human how each ends, or, if their words end the whole session, cancel every open item with those words, children first, then the goal.',
        },
      ]),
    },
  })
})

test('the handoff is returned to Claude, and /zg:copy-handoff copies it', async ($, on) => {
  const world = host(on, { [LOG]: log(finished) })
  await $.session.start(START)

  const written = await $.tool.call({
    tool: 'mcp__zg__handoff',
    next: 'Book the flights',
    decisions: [],
    references: [],
  })
  const copy = await $.command.run(COPY)

  expect({ written, copy, copied: world.copied }).toEqual({
    written: {
      result:
        'Goal: Book the flights\nTo file by hand:\n  - Action: Check school dates\n\nShow the human this handoff verbatim. /zg:copy-handoff copies it, to paste after /clear.',
    },
    copy: { text: 'Copied the handoff: /clear, then paste it.' },
    copied: [
      'Goal: Book the flights\nTo file by hand:\n  - Action: Check school dates',
    ],
  })
})

test('/zg:copy-handoff says how to write one when there is none', async ($, on) => {
  host(on, { [LOG]: log(finished) })
  await $.session.start(START)

  const answer = await $.command.run(COPY)

  expect(answer).toEqual({
    text: 'No handoff yet: /zg:close closes the goal and writes it.',
  })
})

test('/zg:copy-handoff shows the handoff when it cannot copy', async ($, on) => {
  host(
    on,
    { [LOG]: log([...finished, a.handoffWritten()]) },
    {
      isCopied: false,
      reason: 'no-clipboard',
    },
  )
  await $.session.start(START)

  const answer = await $.command.run(COPY)

  expect(answer).toEqual({
    text: "Couldn't copy the handoff (no-clipboard). Here it is:\n\nGoal: Book the flights\nTo file by hand:\n  - Action: Check school dates",
  })
})

const BRIEF =
  'zg: the goal is G Pick a holiday\nOpen actions:\n- A1 Check school dates (human)\nFull view: mcp__zg__show.'

test('after a compaction the goal and open actions are re-injected', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened(), a.actionAdded()]) })

  const answer = await $.classic.SessionStart({ source: 'compact' })

  expect(answer).toEqual({ additionalContext: [BRIEF] })
})

test('after a resume the goal and open actions are re-injected', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened(), a.actionAdded()]) })

  const answer = await $.classic.SessionStart({ source: 'resume' })

  expect(answer).toEqual({ additionalContext: [BRIEF] })
})

test('a resumed session draws its log in the pane', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened(), a.actionAdded()]) })

  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect(pane).toEqual([
    '○ G Pick a holiday',
    '0 open · 0 closed',
    'Actions',
    '☐ A1 Check school dates (human)',
  ])
})

test('a /clear after the handoff closes the session', async ($, on) => {
  const world = host(on, { [LOG]: log([...finished, a.handoffWritten()]) })

  await $.session.end(CLEAR)

  expect(world.files[LOG]).toEqual(
    log([...finished, a.handoffWritten(), a.sessionClosed()]),
  )
})

test('a /clear before the handoff leaves the session open, and is traced', async ($, on) => {
  const world = host(on, { [LOG]: log(finished) })

  await $.session.end(CLEAR)

  expect(world.files).toEqual({
    [LOG]: log(finished),
    [TRACE]: log([
      {
        type: 'CommandRefused',
        at: '2026-10-22T10:00:00.000Z',
        command: a.closeSession(),
        reason:
          'Close only when nothing is open: the session closes after its handoff is written, and none stands.',
        fix: 'Run /zg:close in the session to close the goal and write the handoff.',
      },
    ]),
  })
})

test('a /clear in a session zg never opened writes nothing', async ($, on) => {
  const world = host(on)

  await $.session.end(CLEAR)

  expect(world.files).toEqual({})
})

test('show answers that there is no goal yet', async ($, on) => {
  host(on)

  const ran = await $.tool.call({ tool: 'mcp__zg__show' })

  expect(ran).toEqual({ result: 'No goal yet.' })
})
