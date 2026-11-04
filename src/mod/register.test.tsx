import type {
  PromptAutocompleteInput,
  PromptAutocompleteResult,
} from 'claude-code'
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

test('the next prompt adds the origin to the title once, with the index alongside', async ($, on) => {
  host(on, {
    [LOG]: log([a.goalOpened({ origin: 'zg-abc' }), a.threadOpened()]),
  })
  const prompt = { prompt: 'go on', session_title: 'Pick a holiday' }

  const answers = [
    await $.classic.UserPromptSubmit(prompt),
    await $.classic.UserPromptSubmit(prompt),
  ]

  expect(answers).toEqual([
    {
      sessionTitle: 'zg-abc Pick a holiday',
      additionalContext: ['zg open: T1 Places in Greece'],
    },
    { additionalContext: ['zg open: T1 Places in Greece'] },
  ])
})

test('each prompt brings the index of what is open', async ($, on) => {
  const given = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T1', title: 'Places in Greece' }),
    a.threadOpened({ thread: 'T2', title: 'Places in Spain' }),
    a.threadResolved({ thread: 'T2' }),
    a.actionAdded(),
  ]
  host(on, { [LOG]: log(given) })

  const answer = await $.classic.UserPromptSubmit({ prompt: 'what next?' })

  expect(answer).toEqual({
    additionalContext: ['zg open: T1 Places in Greece | A1 Check school dates'],
  })
})

test('a slash command other than /zg:open still gets the index', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened(), a.threadOpened()]) })

  const answer = await $.classic.UserPromptSubmit({ prompt: '/zg:close' })

  expect(answer).toEqual({
    additionalContext: ['zg open: T1 Places in Greece'],
  })
})

test('/zg:open gets the index alongside the new title', async ($, on) => {
  const given = [a.goalOpened(), a.threadOpened()]
  host(on, { [LOG]: log(given) })

  const answer = await $.classic.UserPromptSubmit({
    prompt: '/zg:open Pick a holiday',
  })

  expect(answer).toEqual({
    sessionTitle: 'Pick a holiday',
    additionalContext: ['zg open: T1 Places in Greece'],
  })
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
      '  ✦ T1 Places in Greece',
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

test('both sides of an exchange are kept on a thread and show under it', async ($, on) => {
  const bus = a.threadOpened({ thread: 'T5', title: '2h bus?' })
  const world = host(on, { [LOG]: log([a.goalOpened(), bus]) })
  await $.session.start(START)

  const answers = [
    await $.tool.call({
      tool: 'mcp__zg__node',
      op: 'reply',
      id: 'T5',
      author: 'human',
      text: 'no, two hours with the kids is a no',
    }),
    await $.tool.call({
      tool: 'mcp__zg__node',
      op: 'reply',
      id: 'T5',
      author: 'claude',
      text: 'Noted: transfers under 30 minutes',
    }),
  ]
  const shown = await $.tool.call({ tool: 'mcp__zg__show' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect({ answers, shown, pane, files: world.files }).toEqual({
    answers: [{ result: 'NodeReplied T5' }, { result: 'NodeReplied T5' }],
    shown: {
      result: [
        '○ G Pick a holiday',
        '1 open · 0 closed',
        '  ○ T5 2h bus?',
        '    #1 human: no, two hours with the kids is a no',
        '    #2 claude: Noted: transfers under 30 minutes',
      ].join('\n'),
    },
    pane: ['○ G Pick a holiday', '1 open · 0 closed', '  ○ T5 2h bus?'],
    files: {
      [LOG]: log([
        a.goalOpened(),
        bus,
        a.nodeReplied({
          node: 'T5',
          author: 'human',
          text: 'no, two hours with the kids is a no',
        }),
        a.nodeReplied({
          node: 'T5',
          author: 'claude',
          text: 'Noted: transfers under 30 minutes',
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

test('the handoff with a thread still open is refused and traced, and writes nothing', async ($, on) => {
  const given = [
    a.goalOpened(),
    a.threadOpened(),
    a.actionAdded(),
    a.threadOpened({ thread: 'T2', title: 'Compare the shortlist' }),
    a.threadResolved(),
    a.actionDone(),
    a.goalAchieved(),
  ]
  const world = host(on, { [LOG]: log(given) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__handoff',
    next: 'Book the flights',
    decisions: [],
    references: [],
  })

  expect({ answer, files: world.files }).toEqual({
    answer: {
      deny: 'Close only when nothing is open: T2 still open. Ask the human how each one ends: the goal achieved, failed or cancelled; each thread resolved or cancelled; each action done, cancelled, or exported to the handoff for filing.',
    },
    files: {
      [LOG]: log(given),
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: a.writeHandoff({ next: 'Book the flights' }),
          reason: 'Close only when nothing is open: T2 still open.',
          fix: 'Ask the human how each one ends: the goal achieved, failed or cancelled; each thread resolved or cancelled; each action done, cancelled, or exported to the handoff for filing.',
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

const BRIEF = [
  'zg: the goal is G Pick a holiday',
  'Open nodes:',
  '- T1 Places in Greece (under G)',
  '- T3 Places in Spain (under T1)',
  'Open actions:',
  '- A1 Check school dates (human)',
  'Full view: mcp__zg__show.',
].join('\n')

const OPEN = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T1', parent: 'G', title: 'Places in Greece' }),
  a.threadOpened({ thread: 'T3', parent: 'T1', title: 'Places in Spain' }),
  a.actionAdded(),
]

test('after a compaction the goal, open threads and open actions are re-injected', async ($, on) => {
  host(on, { [LOG]: log(OPEN) })

  const answer = await $.classic.SessionStart({ source: 'compact' })

  expect(answer).toEqual({ additionalContext: [BRIEF] })
})

const COMPACTED = [
  a.goalOpened(),
  a.decisionOpened(),
  a.optionAdded(),
  a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
  a.optionAdded({ option: 'D1.3', title: 'Rhodes' }),
  a.nodeCancelled({ node: 'D1.1' }),
  a.criterionAdded({ criterion: 'C1', on: 'D1', text: 'Europe' }),
  a.criterionAdded({ criterion: 'C2', on: 'D1', text: 'sea ≥ 20°C' }),
  a.threadOpened({ thread: 'T2', title: 'Places in Greece' }),
  a.threadOpened({ thread: 'T5', title: 'Getting there' }),
  a.decisionOpened({ decision: 'D3', parent: 'T5', title: 'Where to stay' }),
  a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Hotel' }),
  a.criterionAdded({ criterion: 'C3', on: 'D3', text: 'Near the beach' }),
  a.decisionMade({ decision: 'D3', option: 'D3.1' }),
  a.threadResolved({ thread: 'T5' }),
  a.decisionOpened({ decision: 'D5', title: 'Which airline?' }),
  a.optionAdded({ option: 'D5.1', decision: 'D5', title: 'Aegean' }),
  a.decisionMade({ decision: 'D5', option: 'D5.1' }),
  a.decisionOpened({ decision: 'D6', title: 'Rent a car?' }),
  a.optionAdded({ option: 'D6.1', decision: 'D6', title: 'Hertz' }),
  a.criterionAdded({ criterion: 'C6', on: 'D6', text: 'Automatic' }),
  a.nodeCancelled({ node: 'D6' }),
]

test('after a compaction the criteria in force and the last decisions are re-injected', async ($, on) => {
  host(on, { [LOG]: log(COMPACTED) })

  const answer = await $.classic.SessionStart({ source: 'compact' })

  expect(answer).toEqual({
    additionalContext: [
      [
        'zg: the goal is G Pick a holiday',
        'Criteria: C1 Europe (D1) · C2 sea ≥ 20°C (D1) · C3 Near the beach (D3)',
        'Open nodes:',
        '- T2 Places in Greece (under G)',
        '- D1 Which holiday do we book? (under G)',
        '- D1.2 Paphos (under D1)',
        '- D1.3 Rhodes (under D1)',
        'Decisions:',
        '- D3 Where to stay → Hotel (under T5)',
        '- D5 Which airline? → Aegean (under G)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    ],
  })
})

test('after a resume the goal, open threads and open actions are re-injected', async ($, on) => {
  host(on, { [LOG]: log(OPEN) })

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

test('an untouched thread is new in the pane, with its line not dimmed', async ($, on) => {
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
    await $.tool.call({
      tool: 'mcp__zg__node',
      op: 'reply',
      id: 'T1',
      author: 'claude',
      text: 'Rhodes and Crete look best',
    }),
  ]
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect({ answers, pane, files: world.files }).toEqual({
    answers: [
      { result: 'GoalOpened G' },
      { result: 'ThreadOpened T1' },
      { result: 'NodeReplied T1' },
    ],
    pane: [
      { text: '○ G Pick a holiday', isDim: false },
      { text: '1 open · 0 closed', isDim: false },
      { text: '  ✦ T1 Places in Greece', isDim: false },
    ],
    files: {
      [LOG]: log([
        a.goalOpened(),
        a.threadOpened(),
        a.nodeReplied({
          author: 'claude',
          text: 'Rhodes and Crete look best',
        }),
      ]),
    },
  })
})

test('a thread nested on the human’s word moves in the log and the pane, in ID order, and is no longer new', async ($, on) => {
  const spain = a.threadOpened({ thread: 'T2', title: 'Places in Spain' })
  const bus = a.threadOpened({ thread: 'T5', title: '2h bus?' })
  const ferries = a.threadOpened({
    thread: 'T6',
    parent: 'T2',
    title: 'Ferries',
  })
  const world = host(on, { [LOG]: log([a.goalOpened(), spain, bus, ferries]) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__node',
    op: 'nest',
    id: 'T5',
    parent: 'T2',
    source: 'chat',
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect({ answer, pane, files: world.files }).toEqual({
    answer: { result: 'NodeMoved T5' },
    pane: [
      '○ G Pick a holiday',
      '3 open · 0 closed',
      '  ✦ T2 Places in Spain',
      '    ○ T5 2h bus?',
      '    ✦ T6 Ferries',
    ],
    files: {
      [LOG]: log([
        a.goalOpened(),
        spain,
        bus,
        ferries,
        a.nodeMoved({ node: 'T5', parent: 'T2', source: 'chat' }),
      ]),
    },
  })
})

test('threads merged on the human’s word are logged, show as merged in the pane and in show, and hand their children to the target', async ($, on) => {
  const trip = a.threadOpened({ thread: 'T4', title: 'Spain trip' })
  const places = a.threadOpened({ thread: 'T5', title: 'Places in Spain' })
  const again = a.threadOpened({ thread: 'T6', title: 'Spain, again' })
  const ferries = a.threadOpened({
    thread: 'T7',
    parent: 'T4',
    title: 'Ferries',
  })
  const tripSaid = a.nodeReplied({ node: 'T4', text: 'same trip' })
  const placesSaid = a.nodeReplied({
    node: 'T5',
    author: 'claude',
    text: 'Noted',
  })
  const againSaid = a.nodeReplied({ node: 'T6', text: 'still Spain' })
  const before = [
    a.goalOpened(),
    trip,
    places,
    again,
    ferries,
    tripSaid,
    placesSaid,
    againSaid,
  ]
  const world = host(on, { [LOG]: log(before) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__node',
    op: 'merge',
    from: ['T4', 'T6'],
    into: 'T5',
    source: 'chat',
    reason: 'T4–T7 are the same as T5',
  })
  const shown = await $.tool.call({ tool: 'mcp__zg__show' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect({ answer, shown, pane, files: world.files }).toEqual({
    answer: { result: 'NodeMerged T5' },
    shown: {
      result: [
        '○ G Pick a holiday',
        '2 open · 2 closed',
        '  → T4 Spain trip → T5',
        '    #1 human: same trip',
        '  ○ T5 Places in Spain',
        '    merged from T4, T6',
        '    #1 claude: Noted',
        '    ○ T7 Ferries',
        '  → T6 Spain, again → T5',
        '    #1 human: still Spain',
      ].join('\n'),
    },
    pane: [
      { text: '○ G Pick a holiday', isDim: false },
      { text: '2 open · 2 closed', isDim: false },
      { text: '  → T4 Spain trip → T5', isDim: true },
      { text: '  ○ T5 Places in Spain', isDim: false },
      { text: '    ✦ T7 Ferries', isDim: false },
      { text: '  → T6 Spain, again → T5', isDim: true },
    ],
    files: { [LOG]: log([...before, a.nodeMerged()]) },
  })
})

test('a reply moved to the right thread is logged and show lists it there, numbered again on both', async ($, on) => {
  const spain = a.threadOpened({ thread: 'T3', title: 'Places in Spain' })
  const bus = a.threadOpened({ thread: 'T5', title: '2h bus?' })
  const said = a.nodeReplied({
    node: 'T5',
    author: 'claude',
    text: 'Noted',
    at: '2026-10-22T10:00:01.000Z',
  })
  const aboutSpain = a.nodeReplied({
    node: 'T5',
    text: 'that was about Spain',
    at: '2026-10-22T10:00:02.000Z',
  })
  const before = [a.goalOpened(), spain, bus, said, aboutSpain]
  const world = host(on, { [LOG]: log(before) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__node',
    op: 'move_reply',
    id: 'T5',
    ordinal: 2,
    to: 'T3',
  })
  const shown = await $.tool.call({ tool: 'mcp__zg__show' })

  expect({ answer, shown, files: world.files }).toEqual({
    answer: { result: 'ReplyMoved T5' },
    shown: {
      result: [
        '○ G Pick a holiday',
        '2 open · 0 closed',
        '  ○ T3 Places in Spain',
        '    #1 human: that was about Spain',
        '  ○ T5 2h bus?',
        '    #1 claude: Noted',
      ].join('\n'),
    },
    files: {
      [LOG]: log([
        ...before,
        a.replyMoved({
          node: 'T5',
          reply: '2026-10-22T10:00:02.000Z',
          to: 'T3',
        }),
      ]),
    },
  })
})

// Selecting an item: view state only. Pressing a row records nothing and
// asks nothing of the focus ring, so the chat input keeps it. A second press
// on the same row hides the details again; the tree stays visible throughout.
const bus = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T2', title: 'Places in Spain' }),
  a.threadOpened({ thread: 'T5', parent: 'T2', title: '2h bus?' }),
  a.threadOpened({ thread: 'T8', parent: 'T5', title: 'Which village?' }),
  a.threadResolved({ thread: 'T8', outcome: 'village is out' }),
  a.threadOpened({ thread: 'T9', parent: 'T5', title: 'Bus times' }),
  a.nodeReplied({
    node: 'T5',
    author: 'claude',
    text: 'The bus takes two hours each way',
  }),
  a.nodeReplied({ node: 'T5', text: 'no, two hours with the kids is a no' }),
]

const tree = [
  '○ G Pick a holiday',
  '3 open · 1 closed',
  '  ✦ T2 Places in Spain',
  '    ○ T5 2h bus?',
  '      ✓ T8 Which village? → village is out',
  '      ✦ T9 Bus times',
]

const t5 = [
  'T5 2h bus?',
  'under T2',
  'open',
  'children: ✓ T8 Which village? → village is out, ○ T9 Bus times',
  '#1 claude: The bus takes two hours each way',
  '#2 human: no, two hours with the kids is a no',
]

test('selecting a thread’s line shows its details under the tree, records nothing and asks for no focus', async ($, on) => {
  const world = host(on, { [LOG]: log(bus) })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'T5' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  // Focus belongs to the engine; zg's only effect on it is a request, so
  // "asked for none" is how the kit shows the chat input keeps focus.
  expect({ pane, files: world.files, focused: world.focused }).toEqual({
    pane: [...tree, '', ...t5],
    files: { [LOG]: log(bus) },
    focused: [],
  })
})

test('pressing the selected line again hides the details, and the tree was visible throughout', async ($, on) => {
  host(on, { [LOG]: log(bus) })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'T5' })
  await ui.press({ key: 'T5' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect(pane).toEqual(tree)
})

test('the details follow the log: a reply recorded on the selected thread shows at once', async ($, on) => {
  host(on, { [LOG]: log(bus) })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'T5' })
  await $.tool.call({
    tool: 'mcp__zg__node',
    op: 'reply',
    id: 'T5',
    author: 'claude',
    text: 'Noted: the village is out',
  })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect(pane).toEqual([
    ...tree,
    '',
    ...t5,
    '#3 claude: Noted: the village is out',
  ])
})

test('a new session starts with nothing selected', async ($, on) => {
  host(on, { [LOG]: log(bus) })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'T5' })
  await $.session.start(START)
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect(pane).toEqual(tree)
})

test('a /clear ends the selection with the session', async ($, on) => {
  host(on, { [LOG]: log(bus) })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'T5' })
  await $.session.end(CLEAR)
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect(pane).toEqual(tree)
})

// Decisions and options (zg-bam.5.1). The new events are written as literals
// until their builders exist in src/core/a.ts.

const greece = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T2', title: 'Places in Greece' }),
  a.nodeReplied({ node: 'T2' }),
]

const decisionOpened = {
  type: 'DecisionOpened',
  at: AT,
  decision: 'D1',
  parent: 'G',
  title: 'Which holiday do we book?',
}

const greekVillage = {
  type: 'OptionAdded',
  at: AT,
  option: 'D1.1',
  decision: 'D1',
  title: 'Greek village',
}

const paphos = {
  type: 'OptionAdded',
  at: AT,
  option: 'D1.2',
  decision: 'D1',
  title: 'Paphos',
}

type Test = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>

const holiday = async (...[$, on]: Parameters<Test>) => {
  const world = host(on, { [LOG]: log(greece) })
  await $.session.start(START)

  const answers = [
    await $.tool.call({
      tool: 'mcp__zg__decision',
      op: 'open',
      parent: 'G',
      title: 'Which holiday do we book?',
    }),
    await $.tool.call({
      tool: 'mcp__zg__decision',
      op: 'option',
      id: 'D1',
      title: 'Greek village',
    }),
    await $.tool.call({
      tool: 'mcp__zg__decision',
      op: 'option',
      id: 'D1',
      title: 'Paphos',
    }),
    await $.tool.call({
      tool: 'mcp__zg__node',
      op: 'reply',
      id: 'D1.1',
      author: 'human',
      text: 'best beach of the lot, but 2h by bus',
    }),
    await $.tool.call({
      tool: 'mcp__zg__thread',
      op: 'add',
      parent: 'D1.2',
      title: 'Check Paphos flights',
    }),
  ]

  return { world, answers }
}

test('a decision with its options, a reply and a thread under an option are logged in order and the tools name the new IDs', async ($, on) => {
  const { world, answers } = await holiday($, on)

  expect({ answers, files: world.files }).toEqual({
    answers: [
      { result: 'DecisionOpened D1' },
      { result: 'OptionAdded D1.1' },
      { result: 'OptionAdded D1.2' },
      { result: 'NodeReplied D1.1' },
      { result: 'ThreadOpened T3' },
    ],
    files: {
      [LOG]: log([
        ...greece,
        decisionOpened,
        greekVillage,
        paphos,
        a.nodeReplied({
          node: 'D1.1',
          text: 'best beach of the lot, but 2h by bus',
        }),
        a.threadOpened({
          thread: 'T3',
          parent: 'D1.2',
          title: 'Check Paphos flights',
        }),
      ]),
    },
  })
})

test('the pane draws the decision as a tree of its options, new until the human writes to it', async ($, on) => {
  await holiday($, on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect(pane).toEqual([
    { text: '○ G Pick a holiday', isDim: false },
    { text: '5 open · 0 closed', isDim: false },
    { text: '  ○ T2 Places in Greece', isDim: false },
    { text: '  ◆ D1 Which holiday do we book?', isDim: false },
    { text: '    ◇ D1.1 Greek village', isDim: false },
    { text: '    ✦ D1.2 Paphos', isDim: false },
    { text: '      ✦ T3 Check Paphos flights', isDim: false },
  ])
})

test('show with the decision’s ID lists its options with their replies and threads', async ($, on) => {
  await holiday($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D1' })

  expect(shown).toEqual({
    result: [
      'D1 Decision: Which holiday do we book?',
      '   Options:',
      '     ◇ D1.1 Greek village',
      '         #1 human: best beach of the lot, but 2h by bus',
      '     ◇ D1.2 Paphos',
      '         ○ T3 Check Paphos flights',
    ].join('\n'),
  })
})

const options = [...greece, decisionOpened, greekVillage, paphos]

const dropped = async (...[$, on]: Parameters<Test>) => {
  const world = host(on, { [LOG]: log(options) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__node',
    op: 'cancel',
    id: 'D1.1',
    source: 'chat',
    reason: 'too far with the kids',
  })

  return { world, answer }
}

test('an option dropped in the human’s words is cancelled with the reason verbatim', async ($, on) => {
  const { world, answer } = await dropped($, on)

  expect({ answer, files: world.files }).toEqual({
    answer: { result: 'NodeCancelled D1.1' },
    files: {
      [LOG]: log([
        ...options,
        a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
      ]),
    },
  })
})

test('a dropped option shows dimmed in the pane with the reason', async ($, on) => {
  await dropped($, on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect(pane).toEqual([
    { text: '○ G Pick a holiday', isDim: false },
    { text: '3 open · 1 closed', isDim: false },
    { text: '  ○ T2 Places in Greece', isDim: false },
    { text: '  ✦ D1 Which holiday do we book?', isDim: false },
    {
      text: '    ✗ D1.1 Greek village · too far with the kids',
      isDim: true,
    },
    { text: '    ✦ D1.2 Paphos', isDim: false },
  ])
})

test('show with the decision’s ID lists a dropped option with the reason', async ($, on) => {
  await dropped($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D1' })

  expect(shown).toEqual({
    result: [
      'D1 Decision: Which holiday do we book?',
      '   Options:',
      '     ✗ D1.1 Greek village · too far with the kids',
      '     ◇ D1.2 Paphos',
    ].join('\n'),
  })
})

test('show with an ID that names nothing says so and appends nothing', async ($, on) => {
  const world = host(on, { [LOG]: log(bus) })
  await $.session.start(START)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'T99' })

  expect({ shown, files: world.files }).toEqual({
    shown: { result: 'There is no item T99.' },
    files: { [LOG]: log(bus) },
  })
})

test('show with a thread’s ID answers the thread’s details', async ($, on) => {
  host(on, { [LOG]: log(bus) })
  await $.session.start(START)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'T5' })

  expect(shown).toEqual({ result: t5.join('\n') })
})

test('show with an action’s ID answers the action’s details', async ($, on) => {
  const given = [
    a.goalOpened(),
    a.actionAdded(),
    a.actionExported({ reason: 'do this after' }),
  ]
  host(on, { [LOG]: log(given) })
  await $.session.start(START)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'A1' })

  expect(shown).toEqual({
    result: [
      'A1 Check school dates',
      'owner: human',
      'exported → handoff',
      'do this after',
    ].join('\n'),
  })
})

test('an option added to a thread is refused as an error and traced, and nothing is logged', async ($, on) => {
  const given = [a.goalOpened(), a.threadOpened({ thread: 'T1' })]
  const world = host(on, { [LOG]: log(given) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__decision',
    op: 'option',
    id: 'T1',
    title: 'X',
  })

  expect({ answer, files: world.files }).toEqual({
    answer: {
      deny: 'One parent: T1 is a thread, and only a decision holds options. Open a decision under T1, and add the option there.',
    },
    files: {
      [LOG]: log(given),
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: { type: 'AddOption', at: AT, decision: 'T1', title: 'X' },
          reason:
            'One parent: T1 is a thread, and only a decision holds options.',
          fix: 'Open a decision under T1, and add the option there.',
        },
      ]),
    },
  })
})

// Deciding by a pick (zg-bam.5.2).

const costaDelSol = {
  type: 'OptionAdded',
  at: AT,
  option: 'D1.2',
  decision: 'D1',
  title: 'Costa del Sol',
}

const paphosOption = {
  type: 'OptionAdded',
  at: AT,
  option: 'D1.3',
  decision: 'D1',
  title: 'Paphos',
}

const checkFlights = a.threadOpened({
  thread: 'T6',
  parent: 'D1.3',
  title: 'Check Paphos flights',
})

const PAPHOS_THEN = 'Paphos then, the 20 min transfer settles it'

const undecided = [
  a.goalOpened(),
  decisionOpened,
  greekVillage,
  costaDelSol,
  paphosOption,
  a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
]

const pick = {
  tool: 'mcp__zg__decision',
  op: 'decide',
  id: 'D1',
  option: 'D1.3',
  source: 'chat',
  reason: PAPHOS_THEN,
} as const

const picked = async (...[$, on]: Parameters<Test>) => {
  const world = host(on, { [LOG]: log(undecided) })
  await $.session.start(START)

  const answer = await $.tool.call(pick)

  return { world, answer }
}

test('a pick decides the decision and appends exactly one DecisionMade', async ($, on) => {
  const { world, answer } = await picked($, on)

  expect({ answer, files: world.files }).toEqual({
    answer: { result: 'DecisionMade D1' },
    files: { [LOG]: log([...undecided, a.decisionMade()]) },
  })
})

test('a decided decision shows dimmed in the pane with its pick and no options, and the goal counts them closed', async ($, on) => {
  await picked($, on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect(pane).toEqual([
    { text: '○ G Pick a holiday', isDim: false },
    { text: '0 open · 4 closed', isDim: false },
    {
      text: '  ✓ D1 Which holiday do we book? → D1.3 Paphos',
      isDim: true,
    },
  ])
})

test('show with the decided decision’s ID lists the pick, the words behind it and the options as they ended', async ($, on) => {
  await picked($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D1' })

  expect(shown).toEqual({
    result: [
      'D1 Decision: Which holiday do we book?',
      '   Decision: D1.3 Paphos',
      `   because (chat): ${PAPHOS_THEN}`,
      '   Options:',
      '     ✗ D1.1 Greek village · too far with the kids',
      '     · D1.2 Costa del Sol',
      '     ✓ D1.3 Paphos',
    ].join('\n'),
  })
})

const exploring = [...undecided, checkFlights]

const refusedChildren =
  'Children close first: T6 Check Paphos flights is still open under D1.3.'
const childrenFix =
  'Show the human the open children and ask how each ends, or propose one outcome that settles them for the human to confirm.'

test('a pick with an open thread under the option is refused and traced, and nothing is appended', async ($, on) => {
  const world = host(on, { [LOG]: log(exploring) })
  await $.session.start(START)

  const answer = await $.tool.call(pick)

  expect({ answer, files: world.files }).toEqual({
    answer: { deny: `${refusedChildren} ${childrenFix}` },
    files: {
      [LOG]: log(exploring),
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: a.makeDecision(),
          reason: refusedChildren,
          fix: childrenFix,
        },
      ]),
    },
  })
})

const WHY = "we're not going this year"

const everyOptionOpen = [
  a.goalOpened(),
  decisionOpened,
  costaDelSol,
  paphosOption,
]

const cancelD1 = {
  tool: 'mcp__zg__node',
  op: 'cancel',
  id: 'D1',
  source: 'chat',
  reason: WHY,
} as const

test('cancelling a decision appends the one NodeCancelled and nothing for its options', async ($, on) => {
  const world = host(on, { [LOG]: log(everyOptionOpen) })
  await $.session.start(START)

  const answer = await $.tool.call(cancelD1)

  expect({ answer, files: world.files }).toEqual({
    answer: { result: 'NodeCancelled D1' },
    files: {
      [LOG]: log([
        ...everyOptionOpen,
        a.nodeCancelled({ node: 'D1', reason: WHY }),
      ]),
    },
  })
})

test('show lists the options of a cancelled decision as cancelled with it', async ($, on) => {
  host(on, { [LOG]: log(everyOptionOpen) })
  await $.session.start(START)
  await $.tool.call(cancelD1)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D1' })

  expect(
    String((shown as { result: string }).result)
      .split('\n')
      .filter(line => /D1\.\d/.test(line)),
  ).toEqual([
    '     ✗ D1.2 Costa del Sol · with D1',
    '     ✗ D1.3 Paphos · with D1',
  ])
})

test('cancelling a decision with an open thread under an option is refused and traced, and nothing is appended', async ($, on) => {
  const given = [...everyOptionOpen, checkFlights]
  const world = host(on, { [LOG]: log(given) })
  await $.session.start(START)

  const answer = await $.tool.call(cancelD1)

  expect({ answer, files: world.files }).toEqual({
    answer: { deny: `${refusedChildren} ${childrenFix}` },
    files: {
      [LOG]: log(given),
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: a.cancelNode({ node: 'D1', reason: WHY }),
          reason: refusedChildren,
          fix: childrenFix,
        },
      ]),
    },
  })
})

// Recording a realization in one call (zg-bam.5.3).

const transferBus = a.threadOpened({ thread: 'T5', title: '2h bus?' })
const TRANSFER_WORDS =
  'no, two hours with the kids is a no. Keep transfers under 30 min.'

const recordedEvents = [
  {
    type: 'DecisionOpened',
    at: AT,
    decision: 'D2',
    parent: 'T5',
    title: 'How long may the transfer be?',
  },
  {
    type: 'OptionAdded',
    at: AT,
    option: 'D2.1',
    decision: 'D2',
    title: 'transfers ≤ 30 min',
  },
  a.decisionMade({
    decision: 'D2',
    option: 'D2.1',
    reason: TRANSFER_WORDS,
  }),
]

const recordedGiven = [a.goalOpened(), transferBus, decisionOpened]

const recordCall = {
  tool: 'mcp__zg__decision',
  op: 'record',
  parent: 'T5',
  title: 'How long may the transfer be?',
  choice: 'transfers ≤ 30 min',
  source: 'chat',
  reason: TRANSFER_WORDS,
} as const

test('a record appends the opened decision, its option and the pick in that order and names them', async ($, on) => {
  const world = host(on, { [LOG]: log(recordedGiven) })
  await $.session.start(START)

  const answer = await $.tool.call(recordCall)

  expect({ answer, files: world.files }).toEqual({
    answer: {
      result: 'DecisionOpened D2, OptionAdded D2.1, DecisionMade D2',
    },
    files: { [LOG]: log([...recordedGiven, ...recordedEvents]) },
  })
})

test('a recorded decision shows dimmed under its thread with its pick, and the thread stays open', async ($, on) => {
  host(on, { [LOG]: log(recordedGiven) })
  await $.session.start(START)
  await $.tool.call(recordCall)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => ({
    text: text.text,
    isDim: text.props.dimColor,
  }))

  expect(pane).toEqual([
    { text: '○ G Pick a holiday', isDim: false },
    { text: '2 open · 2 closed', isDim: false },
    { text: '  ✦ T5 2h bus?', isDim: false },
    {
      text: '    ✓ D2 How long may the transfer be? → D2.1 transfers ≤ 30 min',
      isDim: true,
    },
    { text: '  ✦ D1 Which holiday do we book?', isDim: false },
  ])
})

// A decision decided again with a new option (zg-bam.5.6).

const TAXI_WORDS = "actually 45 min is fine if it's a taxi"

const decidedOnce = [...recordedGiven, ...recordedEvents]

const decideAgain = {
  tool: 'mcp__zg__decision',
  op: 'decide',
  id: 'D2',
  title: '45 min by taxi',
  source: 'chat',
  reason: TAXI_WORDS,
} as const

test('a decision decided again with a new option appends OptionAdded then DecisionMade, the pane shows the latest pick and show keeps the earlier one', async ($, on) => {
  const world = host(on, { [LOG]: log(decidedOnce) })
  await $.session.start(START)

  const answer = await $.tool.call(decideAgain)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' }))
    .map(text => text.text)
    .filter(text => text.includes('D2'))
  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D2' })

  expect({ answer, files: world.files, pane, shown }).toEqual({
    answer: { result: 'OptionAdded D2.2, DecisionMade D2' },
    files: {
      [LOG]: log([
        ...decidedOnce,
        {
          type: 'OptionAdded',
          at: AT,
          option: 'D2.2',
          decision: 'D2',
          title: '45 min by taxi',
        },
        a.decisionMade({
          decision: 'D2',
          option: 'D2.2',
          reason: TAXI_WORDS,
        }),
      ]),
    },
    pane: ['    ✓ D2 How long may the transfer be? → D2.2 45 min by taxi'],
    shown: {
      result: [
        'D2 Decision: How long may the transfer be?',
        '   Decision: D2.2 45 min by taxi',
        `   because (chat): ${TAXI_WORDS}`,
        '   Options:',
        '     · D2.1 transfers ≤ 30 min',
        '     ✓ D2.2 45 min by taxi',
        `   earlier: D2.1 transfers ≤ 30 min · because (chat): ${TRANSFER_WORDS}`,
      ].join('\n'),
    },
  })
})

// Criteria on a decision (zg-bam.5.4).

const add = (on: string, text: string, origin?: string) =>
  ({
    tool: 'mcp__zg__criterion',
    op: 'add',
    on,
    text,
    ...(origin === undefined ? {} : { origin }),
  }) as const

const judging = [a.goalOpened(), decisionOpened, greekVillage]

test('criteria added to a decision are logged with their IDs and drawn under it, before its options', async ($, on) => {
  const world = host(on, { [LOG]: log(judging) })
  await $.session.start(START)

  const answers = [
    await $.tool.call(add('D1', 'Europe')),
    await $.tool.call(add('D1', 'sea ≥ 18°C')),
  ]
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)

  expect({ answers, files: world.files, pane }).toEqual({
    answers: [{ result: 'CriterionAdded C1' }, { result: 'CriterionAdded C2' }],
    files: {
      [LOG]: log([
        ...judging,
        a.criterionAdded(),
        a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
      ]),
    },
    pane: [
      '○ G Pick a holiday',
      '2 open · 0 closed',
      '  ✦ D1 Which holiday do we book?',
      '      C1 Europe',
      '      C2 sea ≥ 18°C',
      '    ✦ D1.1 Greek village',
    ],
  })
})

const deepGiven = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T5', title: '2h bus?' }),
  decisionOpened,
  a.criterionAdded(),
  a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
  paphosOption,
  a.decisionOpened({ decision: 'D3', parent: 'D1.3', title: 'Which flights?' }),
  a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Direct' }),
  a.decisionOpened({ decision: 'D7', parent: 'D3.1', title: 'Which seats?' }),
  a.criterionAdded({ criterion: 'C3', on: 'D7', text: 'quiet' }),
  a.threadOpened({ thread: 'T6', parent: 'D1.3', title: 'Check flights' }),
  a.decisionOpened({ decision: 'D4', title: 'Which hotel?' }),
  a.decisionOpened({ decision: 'D2', parent: 'T5', title: 'How long?' }),
  a.optionAdded({
    option: 'D2.1',
    decision: 'D2',
    title: 'transfers ≤ 30 min',
  }),
  a.decisionMade({ decision: 'D2', option: 'D2.1' }),
]

const deepWorld = async (...[$, on]: Parameters<Test>) => {
  const world = host(on, { [LOG]: log(deepGiven) })
  await $.session.start(START)
  const answer = await $.tool.call(add('D1', 'transfer ≤ 30 min', 'D2'))

  return { world, answer }
}

const INHERITED =
  'C1 Europe (D1) · C2 sea ≥ 18°C (D1) · C4 transfer ≤ 30 min (D1, from D2)'

test('a criterion found in a decided decision is logged with its origin', async ($, on) => {
  const { world, answer } = await deepWorld($, on)

  expect({ answer, files: world.files }).toEqual({
    answer: { result: 'CriterionAdded C4' },
    files: {
      [LOG]: log([
        ...deepGiven,
        a.criterionAdded({
          criterion: 'C4',
          text: 'transfer ≤ 30 min',
          origin: 'D2',
        }),
      ]),
    },
  })
})

test('show for a decision deep under the options lists its own criteria, then those it inherits', async ($, on) => {
  await deepWorld($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D7' })

  expect(shown).toEqual({
    result: [
      'D7 Decision: Which seats?',
      '   Criteria: C3 quiet',
      `             ${INHERITED}`,
      '   Options:',
    ].join('\n'),
  })
})

test('show for a decision under an option lists the criteria it inherits', async ($, on) => {
  await deepWorld($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D3' })

  expect(shown).toEqual({
    result: [
      'D3 Decision: Which flights?',
      `   Criteria: ${INHERITED}`,
      '   Options:',
      '     ◇ D3.1 Direct',
      '         ◆ D7 Which seats?',
    ].join('\n'),
  })
})

test('show for a thread under an option lists the criteria in force', async ($, on) => {
  await deepWorld($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'T6' })

  expect(shown).toEqual({
    result: [
      'T6 Check flights',
      'under D1.3',
      'open',
      `Criteria in force: ${INHERITED}`,
    ].join('\n'),
  })
})

test('show for a decision beside it lists no criteria', async ($, on) => {
  await deepWorld($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'D4' })

  expect(String((shown as { result: string }).result).split('\n')).toEqual([
    'D4 Decision: Which hotel?',
    '   Options:',
  ])
})

test('show with the criterion’s ID says where it sits and came up', async ($, on) => {
  await deepWorld($, on)

  const shown = await $.tool.call({ tool: 'mcp__zg__show', id: 'C4' })

  expect(shown).toEqual({ result: 'C4 transfer ≤ 30 min (on D1, from D2)' })
})

test('a criterion on the goal is refused as an error and traced, and nothing is logged', async ($, on) => {
  const world = host(on, { [LOG]: log(judging) })
  await $.session.start(START)

  const answer = await $.tool.call(add('G', 'Europe'))

  expect({ answer, files: world.files }).toEqual({
    answer: {
      deny: 'One parent: a criterion belongs to a decision, not the goal. Open the decision it serves.',
    },
    files: {
      [LOG]: log(judging),
      [TRACE]: log([
        {
          type: 'CommandRefused',
          at: AT,
          command: { type: 'AddCriterion', at: AT, on: 'G', text: 'Europe' },
          reason:
            'One parent: a criterion belongs to a decision, not the goal.',
          fix: 'Open the decision it serves.',
        },
      ]),
    },
  })
})

// Revising a criterion (zg-bam.5.5).

const revisionGiven = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T5', title: '2h bus?' }),
  decisionOpened,
  a.criterionAdded(),
  a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
]

test('a revised criterion is logged with its origin, drawn with its new wording, and show keeps the old one', async ($, on) => {
  const world = host(on, { [LOG]: log(revisionGiven) })
  await $.session.start(START)

  const answer = await $.tool.call({
    tool: 'mcp__zg__criterion',
    op: 'revise',
    id: 'C2',
    text: 'sea ≥ 20°C',
    origin: 'T5',
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pane = (await ui.findAll({ type: 'Text' })).map(text => text.text)
  const c2 = await $.tool.call({ tool: 'mcp__zg__show', id: 'C2' })
  const d1 = await $.tool.call({ tool: 'mcp__zg__show', id: 'D1' })

  expect({ answer, files: world.files, pane, c2, d1 }).toEqual({
    answer: { result: 'CriterionRevised C2' },
    files: { [LOG]: log([...revisionGiven, a.criterionRevised()]) },
    pane: [
      '○ G Pick a holiday',
      '2 open · 0 closed',
      '  ✦ T5 2h bus?',
      '  ✦ D1 Which holiday do we book?',
      '      C1 Europe',
      '      C2 sea ≥ 20°C',
    ],
    c2: { result: 'C2 sea ≥ 20°C (on D1, from T5)\n  was: sea ≥ 18°C' },
    d1: {
      result:
        'D1 Decision: Which holiday do we book?\n   Criteria: C1 Europe · C2 sea ≥ 20°C (from T5)\n   Options:',
    },
  })
})

// Wiring of the reply list: the rule is replyRows, tested in src/core.
const threads = [
  a.threadOpened({ thread: 'T1', title: 'Places in Greece' }),
  a.threadOpened({ thread: 'T2', title: 'Places in Spain' }),
  a.threadOpened({ thread: 'T3', title: 'Places in Italy' }),
  a.threadOpened({ thread: 'T4', title: 'Places in Malta' }),
  a.threadOpened({ thread: 'T5', title: 'Bus village' }),
  a.threadOpened({ thread: 'T6', title: 'Flights out' }),
  a.threadResolved({ thread: 'T2' }),
  a.threadResolved({ thread: 'T3' }),
  a.threadResolved({ thread: 'T4' }),
]

const typed = (text: string, token: string) => ({
  text,
  cursor: text.length,
  token,
  start: text.length - token.length,
})

// The vendored types (2.1.309) lag the installed engine, which has
// prompt.autocomplete at runtime.
const autocomplete = (
  $: { prompt: object },
  input: PromptAutocompleteInput,
): Promise<PromptAutocompleteResult> =>
  (
    $.prompt as {
      autocomplete(
        i: PromptAutocompleteInput,
      ): Promise<PromptAutocompleteResult>
    }
  ).autocomplete(input)

test('typing T at the start of a line lists the open threads that the draft does not name', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened(), ...threads]) })

  const answer = await autocomplete(
    $,
    typed('T5: skip the bus village\nT', 'T'),
  )

  expect(answer).toEqual({
    suggestions: [
      { text: 'T1: ', label: 'T1', description: 'Places in Greece' },
      { text: 'T6: ', label: 'T6', description: 'Flights out' },
    ],
  })
})

test('taking a row writes the prefix in upper case', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened(), ...threads]) })

  const answer = await autocomplete($, typed('t', 't'))

  expect(answer).toEqual({
    suggestions: [
      { text: 'T1: ', label: 'T1', description: 'Places in Greece' },
      { text: 'T5: ', label: 'T5', description: 'Bus village' },
      { text: 'T6: ', label: 'T6', description: 'Flights out' },
    ],
  })
})

test('a digit narrows the list to that thread', async ($, on) => {
  host(on, { [LOG]: log([a.goalOpened(), ...threads]) })

  const answer = await autocomplete($, typed('T5', 'T5'))

  expect(answer).toEqual({
    suggestions: [{ text: 'T5: ', label: 'T5', description: 'Bus village' }],
  })
})

// zg-bam.16: the other kinds' letters list their items; the rules are in
// src/core/reply-rows.test.ts.
const items = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T1', title: 'Places in Greece' }),
  a.actionAdded({ action: 'A1', text: 'Check school dates' }),
  a.actionAdded({ action: 'A2', text: 'Book the flights' }),
  a.decisionOpened({ decision: 'D1', title: 'Which holiday do we book?' }),
  a.optionAdded({ option: 'D1.1', decision: 'D1', title: 'Greek village' }),
  a.criterionAdded({ criterion: 'C1', on: 'D1', text: 'Europe' }),
]

test('typing a at the start of a line lists the actions with their text', async ($, on) => {
  host(on, { [LOG]: log(items) })

  const answer = await autocomplete($, typed('a', 'a'))

  expect(answer).toEqual({
    suggestions: [
      { text: 'A1: ', label: 'A1', description: 'Check school dates' },
      { text: 'A2: ', label: 'A2', description: 'Book the flights' },
    ],
  })
})

test('typing d at the start of a line lists the decisions and not their options', async ($, on) => {
  host(on, { [LOG]: log(items) })

  const answer = await autocomplete($, typed('d', 'd'))

  expect(answer).toEqual({
    suggestions: [
      { text: 'D1: ', label: 'D1', description: 'Which holiday do we book?' },
    ],
  })
})

test('typing c at the start of a line lists the criteria', async ($, on) => {
  host(on, { [LOG]: log(items) })

  const answer = await autocomplete($, typed('c', 'c'))

  expect(answer).toEqual({
    suggestions: [{ text: 'C1: ', label: 'C1', description: 'Europe' }],
  })
})

test('a digit after a narrows the list to that action', async ($, on) => {
  host(on, { [LOG]: log(items) })

  const answer = await autocomplete($, typed('a2', 'a2'))

  expect(answer).toEqual({
    suggestions: [
      { text: 'A2: ', label: 'A2', description: 'Book the flights' },
    ],
  })
})
