import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { fold } from './evolve.ts'
import { fullView, overview } from './overview.ts'

test('a session without a goal says so', () => {
  expect(overview(fold([]))).toEqual([{ text: 'No goal yet.', isOpen: false }])
})

test('shows each goal and action with how it stands', () => {
  const state = fold([
    a.goalOpened({ origin: 'zg-bam.2' }),
    a.actionAdded(),
    a.actionAdded({ action: 'A2', text: 'Book flights', owner: 'claude' }),
    a.actionAdded({ action: 'A3', text: 'Rent a car' }),
    a.actionAdded({ action: 'A4', text: 'Pack' }),
    a.actionDone({ action: 'A2' }),
    a.actionCancelled({ action: 'A3', reason: 'taxis are fine' }),
    a.actionExported({ action: 'A4' }),
  ])

  expect(overview(state)).toEqual([
    { text: '○ G Pick a holiday (zg-bam.2)', isOpen: true },
    { text: '0 open · 0 closed', isOpen: true },
    { text: 'Actions', isOpen: false },
    { text: '☐ A1 Check school dates (human)', isOpen: true, item: 'A1' },
    { text: '✓ A2 Book flights (claude)', isOpen: false, item: 'A2' },
    {
      text: '✗ A3 Rent a car (human) · taxis are fine',
      isOpen: false,
      item: 'A3',
    },
    { text: '→ A4 Pack (human) → handoff', isOpen: false, item: 'A4' },
  ])
})

test('shows the threads as a tree under the goal, with how many are open', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened(),
    a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Rhodes' }),
    a.threadOpened({ thread: 'T3', title: 'Flights' }),
  ])

  expect(overview(state)).toEqual([
    { text: '○ G Pick a holiday', isOpen: true },
    { text: '3 open · 0 closed', isOpen: true },
    { text: '  ✦ T1 Places in Greece', isOpen: true, item: 'T1' },
    { text: '    ✦ T2 Rhodes', isOpen: true, item: 'T2' },
    { text: '  ✦ T3 Flights', isOpen: true, item: 'T3' },
  ])
})

test('shows closed threads dimmed at their depth, with the outcome or the reason, and counts them', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened(),
    a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Rhodes' }),
    a.threadOpened({ thread: 'T3', title: 'Flights' }),
    a.threadResolved({ thread: 'T2', outcome: 'Rhodes and Crete' }),
    a.nodeCancelled({ node: 'T3', reason: 'not going to Greece' }),
  ])

  expect(overview(state)).toEqual([
    { text: '○ G Pick a holiday', isOpen: true },
    { text: '1 open · 2 closed', isOpen: true },
    { text: '  ✦ T1 Places in Greece', isOpen: true, item: 'T1' },
    { text: '    ✓ T2 Rhodes → Rhodes and Crete', isOpen: false, item: 'T2' },
    { text: '  ✗ T3 Flights · not going to Greece', isOpen: false, item: 'T3' },
  ])
})

test('shows the reason after any outcome that has one', () => {
  const state = fold([
    a.goalOpened(),
    a.actionAdded({ action: 'A2', text: 'Book flights', owner: 'claude' }),
    a.actionAdded({ action: 'A4', text: 'Pack' }),
    a.actionDone({ action: 'A2', reason: 'shipped' }),
    a.actionExported({ action: 'A4', reason: 'for the next trip' }),
    a.goalAchieved({ reason: 'good enough' }),
  ])

  expect(overview(state)).toEqual([
    { text: '✓ G Pick a holiday · achieved: good enough', isOpen: false },
    { text: '0 open · 0 closed', isOpen: false },
    { text: 'Actions', isOpen: false },
    { text: '✓ A2 Book flights (claude) · shipped', isOpen: false, item: 'A2' },
    {
      text: '→ A4 Pack (human) → handoff · for the next trip',
      isOpen: false,
      item: 'A4',
    },
  ])
})

test('the full view ends with the handoff once it is written', () => {
  const state = fold([a.goalOpened(), a.goalFailed(), a.handoffWritten()])

  expect(fullView(state)).toBe(
    [
      '✗ G Pick a holiday · failed: nowhere meets every criterion',
      '0 open · 0 closed',
      'Handoff written: /zg:copy-handoff copies it.',
      '',
      'Goal: Book the flights',
    ].join('\n'),
  )
})

test('a handoff is out of date once work goes on past it', () => {
  const state = fold([
    a.goalOpened(),
    a.goalAchieved(),
    a.handoffWritten(),
    a.goalOpened({ goal: 'G2', text: 'Plan the bars' }),
  ])

  expect(overview(state)).toEqual([
    { text: '✓ G Pick a holiday · achieved', isOpen: false },
    { text: '0 open · 0 closed', isOpen: false },
    { text: '○ G2 Plan the bars', isOpen: true },
    { text: '0 open · 0 closed', isOpen: true },
    { text: 'Handoff out of date: write it again.', isOpen: false },
  ])
})

const talk = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T5', title: '2h bus?' }),
  a.threadOpened({ thread: 'T6', parent: 'T5', title: 'Transfers' }),
  a.threadOpened({ thread: 'T7', title: 'Flights' }),
  a.nodeReplied({ node: 'T5' }),
  a.nodeReplied({ node: 'T7', text: 'only direct' }),
  a.nodeReplied({
    node: 'T5',
    author: 'claude',
    text: 'Noted: transfers under 30 minutes',
  }),
]

test('the full view lists a thread’s replies under it, before its children, numbered per thread in log order', () => {
  expect(fullView(fold(talk))).toBe(
    [
      '○ G Pick a holiday',
      '3 open · 0 closed',
      '  ○ T5 2h bus?',
      '    #1 human: no, two hours with the kids is a no',
      '    #2 claude: Noted: transfers under 30 minutes',
      '    ○ T6 Transfers',
      '  ○ T7 Flights',
      '    #1 human: only direct',
    ].join('\n'),
  )
})

test('a reply with several lines keeps every later line under its own text, so it cannot pass for a reply or a node', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
    a.nodeReplied({ node: 'T5', text: 'fine\n    #2 claude: agreed' }),
  ])

  expect(fullView(state)).toBe(
    [
      '○ G Pick a holiday',
      '1 open · 0 closed',
      '  ○ T5 2h bus?',
      '    #1 human: fine',
      '                  #2 claude: agreed',
    ].join('\n'),
  )
})

test('the pane’s overview leaves replies out', () => {
  expect(overview(fold(talk)).map(line => line.text)).toEqual([
    '○ G Pick a holiday',
    '3 open · 0 closed',
    '  ○ T5 2h bus?',
    '    ✦ T6 Transfers',
    '  ○ T7 Flights',
  ])
})

describe('threads merged into another', () => {
  const merged = fold([
    a.goalOpened(),
    a.threadOpened({ thread: 'T4', title: 'Spain trip' }),
    a.threadOpened({ thread: 'T5', title: 'Places in Spain' }),
    a.threadOpened({ thread: 'T6', title: 'Spain, again' }),
    a.threadOpened({ thread: 'T7', parent: 'T4', title: 'Ferries' }),
    a.nodeReplied({ node: 'T4', text: 'same trip' }),
    a.nodeReplied({ node: 'T5', author: 'claude', text: 'Noted' }),
    a.nodeReplied({ node: 'T6', text: 'still Spain' }),
    a.nodeMerged(),
  ])

  test('the pane shows a merged thread dimmed, with where it went, and its children under the target', () => {
    expect(overview(merged)).toEqual([
      { text: '○ G Pick a holiday', isOpen: true },
      { text: '2 open · 2 closed', isOpen: true },
      { text: '  → T4 Spain trip → T5', isOpen: false, item: 'T4' },
      { text: '  ○ T5 Places in Spain', isOpen: true, item: 'T5' },
      { text: '    ✦ T7 Ferries', isOpen: true, item: 'T7' },
      { text: '  → T6 Spain, again → T5', isOpen: false, item: 'T6' },
    ])
  })

  test('the full view lists under the target what was merged into it, before its replies, and leaves each merged thread’s replies on it', () => {
    expect(fullView(merged)).toBe(
      [
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
    )
  })
})

test('after a reply moves, the full view numbers each thread’s replies again, the moved one in log order on its new thread', () => {
  const spain = '2026-10-22T10:00:02.000Z'
  const state = fold([
    a.goalOpened(),
    a.threadOpened({ thread: 'T3', title: 'Places in Spain' }),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
    a.nodeReplied({ node: 'T3', text: 'Spain is out' }),
    a.nodeReplied({
      node: 'T5',
      text: 'two hours is too long',
      at: '2026-10-22T10:00:01.000Z',
    }),
    a.nodeReplied({ node: 'T5', text: 'that was about Spain', at: spain }),
    a.nodeReplied({
      node: 'T5',
      author: 'claude',
      text: 'Noted',
      at: '2026-10-22T10:00:03.000Z',
    }),
    a.replyMoved({ node: 'T5', reply: spain, to: 'T3' }),
  ])

  expect(fullView(state)).toBe(
    [
      '○ G Pick a holiday',
      '2 open · 0 closed',
      '  ○ T3 Places in Spain',
      '    #1 human: Spain is out',
      '    #2 human: that was about Spain',
      '  ○ T5 2h bus?',
      '    #1 human: two hours is too long',
      '    #2 claude: Noted',
    ].join('\n'),
  )
})

test('a moved reply takes its place among the new thread’s replies by when it was said, not at the end', () => {
  const spain = '2026-10-22T10:00:02.000Z'
  const state = fold([
    a.goalOpened(),
    a.threadOpened({ thread: 'T3', title: 'Places in Spain' }),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
    a.nodeReplied({ node: 'T5', text: 'that was about Spain', at: spain }),
    a.nodeReplied({
      node: 'T3',
      text: 'Spain is back on',
      at: '2026-10-22T10:00:05.000Z',
    }),
    a.replyMoved({ node: 'T5', reply: spain, to: 'T3' }),
  ])

  expect(fullView(state)).toBe(
    [
      '○ G Pick a holiday',
      '2 open · 0 closed',
      '  ○ T3 Places in Spain',
      '    #1 human: that was about Spain',
      '    #2 human: Spain is back on',
      '  ○ T5 2h bus?',
    ].join('\n'),
  )
})

describe('a decision and its options', () => {
  const holiday = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T2', title: 'Places in Greece' }),
    a.nodeReplied({ node: 'T2', text: 'Greece first' }),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
    a.nodeReplied({
      node: 'D1.1',
      text: 'best beach of the lot, but 2h by bus',
    }),
    a.threadOpened({
      thread: 'T3',
      parent: 'D1.2',
      title: 'Check Paphos flights',
    }),
  ]

  test('the pane draws the decision ◆ and its options ◇ one level under it, ✦ while nobody has written to them, and counts every node', () => {
    expect(overview(fold(holiday))).toEqual([
      { text: '○ G Pick a holiday', isOpen: true },
      { text: '5 open · 0 closed', isOpen: true },
      { text: '  ○ T2 Places in Greece', isOpen: true, item: 'T2' },
      {
        text: '  ◆ D1 Which holiday do we book?',
        isOpen: true,
        item: 'D1',
      },
      { text: '    ◇ D1.1 Greek village', isOpen: true, item: 'D1.1' },
      { text: '    ✦ D1.2 Paphos', isOpen: true, item: 'D1.2' },
      { text: '      ✦ T3 Check Paphos flights', isOpen: true, item: 'T3' },
    ])
  })

  test('a decision nobody has written to is ✦', () => {
    const state = fold([a.goalOpened(), a.decisionOpened(), a.optionAdded()])

    expect(overview(state).map(line => line.text)).toEqual([
      '○ G Pick a holiday',
      '2 open · 0 closed',
      '  ✦ D1 Which holiday do we book?',
      '    ✦ D1.1 Greek village',
    ])
  })

  test('a dropped option is drawn ✗ with the human’s reason, dimmed, and counted closed', () => {
    const state = fold([
      ...holiday,
      a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
    ])

    expect(overview(state).slice(1, 6)).toEqual([
      { text: '4 open · 1 closed', isOpen: true },
      { text: '  ○ T2 Places in Greece', isOpen: true, item: 'T2' },
      {
        text: '  ◆ D1 Which holiday do we book?',
        isOpen: true,
        item: 'D1',
      },
      {
        text: '    ✗ D1.1 Greek village · too far with the kids',
        isOpen: false,
        item: 'D1.1',
      },
      { text: '    ✦ D1.2 Paphos', isOpen: true, item: 'D1.2' },
    ])
  })

  test('siblings draw threads before decisions, whatever the log order', () => {
    const state = fold([
      a.goalOpened(),
      a.decisionOpened(),
      a.threadOpened({ thread: 'T1' }),
    ])

    expect(overview(state).map(line => line.text)).toEqual([
      '○ G Pick a holiday',
      '2 open · 0 closed',
      '  ✦ T1 Places in Greece',
      '  ✦ D1 Which holiday do we book?',
    ])
  })

  test('options draw in numeric order, so D1.10 comes after D1.9', () => {
    const state = fold([
      a.goalOpened(),
      a.decisionOpened(),
      a.optionAdded({ option: 'D1.10', title: 'Tenth' }),
      a.optionAdded({ option: 'D1.9', title: 'Ninth' }),
    ])

    expect(overview(state).map(line => line.text)).toEqual([
      '○ G Pick a holiday',
      '3 open · 0 closed',
      '  ✦ D1 Which holiday do we book?',
      '    ✦ D1.9 Ninth',
      '    ✦ D1.10 Tenth',
    ])
  })

  test('the full view marks the decision ◆ and its options ◇, with their replies and children, and no ✦', () => {
    expect(fullView(fold(holiday))).toBe(
      [
        '○ G Pick a holiday',
        '5 open · 0 closed',
        '  ○ T2 Places in Greece',
        '    #1 human: Greece first',
        '  ◆ D1 Which holiday do we book?',
        '    ◇ D1.1 Greek village',
        '      #1 human: best beach of the lot, but 2h by bus',
        '    ◇ D1.2 Paphos',
        '      ○ T3 Check Paphos flights',
      ].join('\n'),
    )
  })
})

describe('a closed decision collapses its options into its line', () => {
  const holiday = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
  ]

  test('a decided decision is drawn ✓ with its pick, dimmed, with no option lines, and the goal counts all four closed', () => {
    expect(overview(fold([...holiday, a.decisionMade()]))).toEqual([
      { text: '○ G Pick a holiday', isOpen: true },
      { text: '0 open · 4 closed', isOpen: true },
      {
        text: '  ✓ D1 Which holiday do we book? → D1.3 Paphos',
        isOpen: false,
        item: 'D1',
      },
    ])
  })

  test('nothing under the options is drawn either, though it counts', () => {
    const given = [
      ...holiday,
      a.threadOpened({
        thread: 'T6',
        parent: 'D1.3',
        title: 'Check Paphos flights',
      }),
      a.threadResolved({ thread: 'T6' }),
      a.decisionMade(),
    ]

    expect(overview(fold(given)).map(line => line.text)).toEqual([
      '○ G Pick a holiday',
      '0 open · 5 closed',
      '  ✓ D1 Which holiday do we book? → D1.3 Paphos',
    ])
  })

  test('a cancelled decision is drawn ✗ with the human’s reason, dimmed, with no option lines', () => {
    const given = [
      ...holiday,
      a.nodeCancelled({ node: 'D1', reason: "we're not going this year" }),
    ]

    expect(overview(fold(given))).toEqual([
      { text: '○ G Pick a holiday', isOpen: true },
      { text: '0 open · 4 closed', isOpen: true },
      {
        text: "  ✗ D1 Which holiday do we book? · we're not going this year",
        isOpen: false,
        item: 'D1',
      },
    ])
  })
})

describe('the full view lists what the pane folds', () => {
  const decided = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.threadOpened({
      thread: 'T6',
      parent: 'D1.3',
      title: 'Check Paphos flights',
    }),
    a.threadResolved({ thread: 'T6', outcome: 'direct, Thursday and Sunday' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
    a.decisionMade(),
  ]

  test('a decided decision is listed with its options as they ended and the exploration under the option chosen', () => {
    expect(fullView(fold(decided))).toEqual(
      [
        '○ G Pick a holiday',
        '0 open · 5 closed',
        '  ✓ D1 Which holiday do we book? → D1.3 Paphos',
        '    ✗ D1.1 Greek village · too far with the kids',
        '    · D1.2 Costa del Sol',
        '    ✓ D1.3 Paphos',
        '      ✓ T6 Check Paphos flights → direct, Thursday and Sunday',
      ].join('\n'),
    )
  })
})

describe('a decision’s criteria', () => {
  const judged = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.criterionAdded(),
    a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
  ]

  test('the pane draws them one per line under their decision, before its options, two spaces deeper than the options and selectable', () => {
    expect(
      overview(fold([...judged, a.nodeReplied({ node: 'D1.1' })])),
    ).toEqual([
      { text: '○ G Pick a holiday', isOpen: true },
      { text: '2 open · 0 closed', isOpen: true },
      { text: '  ◆ D1 Which holiday do we book?', isOpen: true, item: 'D1' },
      { text: '      C1 Europe', isOpen: true, item: 'C1' },
      { text: '      C2 sea ≥ 18°C', isOpen: true, item: 'C2' },
      { text: '    ◇ D1.1 Greek village', isOpen: true, item: 'D1.1' },
    ])
  })

  test('the pane folds them with the options of a decided decision', () => {
    const decided = [
      ...judged,
      a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
      a.decisionMade(),
    ]

    expect(overview(fold(decided)).map(line => line.text)).toEqual([
      '○ G Pick a holiday',
      '0 open · 3 closed',
      '  ✓ D1 Which holiday do we book? → D1.3 Paphos',
    ])
  })

  test('the full view lists a decided decision’s, before its options', () => {
    const decided = [
      ...judged,
      a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
      a.decisionMade(),
    ]

    expect(fullView(fold(decided))).toBe(
      [
        '○ G Pick a holiday',
        '0 open · 3 closed',
        '  ✓ D1 Which holiday do we book? → D1.3 Paphos',
        '      C1 Europe',
        '      C2 sea ≥ 18°C',
        '    · D1.1 Greek village',
        '    ✓ D1.3 Paphos',
      ].join('\n'),
    )
  })
})

describe('a revised criterion in the pane', () => {
  test('is drawn with its current text', () => {
    const given = [
      a.goalOpened(),
      a.decisionOpened(),
      a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
      a.criterionRevised(),
    ]

    expect(overview(fold(given)).filter(line => line.item === 'C2')).toEqual([
      { text: '      C2 sea ≥ 20°C', isOpen: true, item: 'C2' },
    ])
  })
})
