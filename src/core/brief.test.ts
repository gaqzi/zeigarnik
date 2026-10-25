import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { brief } from './brief.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'

// zg-n27: re-injection stays within 2k tokens, at about four characters a
// token, however much the session holds.
const BUDGET = 2000

const tokens = (text: string) => Math.ceil(text.length / 4)

const threads = (count: number, title = 'Places in Greece'): Event[] =>
  Array.from({ length: count }, (_, n) =>
    a.threadOpened({ thread: `T${n + 1}`, title }),
  )

const actions = (count: number, text = 'Check school dates'): Event[] =>
  Array.from({ length: count }, (_, n) =>
    a.actionAdded({ action: `A${n + 1}`, text }),
  )

const decisionsWithAnOption = (
  count: number,
  title = (n: number) => `Decision ${n}`,
  option = (n: number) => `Option ${n}`,
): Event[] =>
  Array.from({ length: count }, (_, n) => [
    a.decisionOpened({ decision: `D${n + 1}`, title: title(n + 1) }),
    a.optionAdded({
      option: `D${n + 1}.1`,
      decision: `D${n + 1}`,
      title: option(n + 1),
    }),
  ]).flat()

const chosen = (...numbers: number[]): Event[] =>
  numbers.map(n => a.decisionMade({ decision: `D${n}`, option: `D${n}.1` }))

const criteria = (
  count: number,
  on = 'D1',
  text = (n: number) => `Criterion ${n}`,
): Event[] =>
  Array.from({ length: count }, (_, n) =>
    a.criterionAdded({ criterion: `C${n + 1}`, on, text: text(n + 1) }),
  )

test('nothing is re-injected before a goal is opened', () => {
  expect(brief(fold([]))).toBeUndefined()
})

test('the open goal and its open actions, and where the full view is', () => {
  const state = fold([
    a.goalOpened({ origin: 'zg-bam.2' }),
    a.actionAdded(),
    a.actionAdded({ action: 'A2', text: 'Book flights', owner: 'claude' }),
    a.actionDone(),
  ])

  expect(brief(state)).toBe(
    [
      'zg: the goal is G Pick a holiday (zg-bam.2)',
      'Open actions:',
      '- A2 Book flights (claude)',
      'Full view: mcp__zg__show.',
    ].join('\n'),
  )
})

test('the open threads with their parents, between the goal and the actions', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened({ thread: 'T1', parent: 'G', title: 'Places in Greece' }),
    a.threadOpened({ thread: 'T2', parent: 'G', title: 'Getting there' }),
    a.threadOpened({ thread: 'T3', parent: 'T1', title: 'Rhodes or Crete' }),
    a.threadResolved({ thread: 'T2' }),
    a.actionAdded(),
  ])

  expect(brief(state)).toBe(
    [
      'zg: the goal is G Pick a holiday',
      'Open nodes:',
      '- T1 Places in Greece (under G)',
      '- T3 Rhodes or Crete (under T1)',
      'Open actions:',
      '- A1 Check school dates (human)',
      'Full view: mcp__zg__show.',
    ].join('\n'),
  )
})

describe('the open nodes are listed in the pane’s sibling order, whatever the log order', () => {
  test('threads before decisions, options right under their decision, and what is under an option after it', () => {
    const state = fold([
      a.goalOpened(),
      a.decisionOpened(),
      a.optionAdded(),
      a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
      a.threadOpened({ thread: 'T2', title: 'Places in Greece' }),
      a.threadOpened({
        thread: 'T3',
        parent: 'D1.1',
        title: 'Check village buses',
      }),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Open nodes:',
        '- T2 Places in Greece (under G)',
        '- D1 Which holiday do we book? (under G)',
        '- D1.1 Greek village (under D1)',
        '- T3 Check village buses (under D1.1)',
        '- D1.2 Paphos (under D1)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })

  test('options are numeric, so D1.9 comes before D1.10', () => {
    const state = fold([
      a.goalOpened(),
      a.decisionOpened(),
      a.optionAdded({ option: 'D1.10', title: 'Tenth' }),
      a.optionAdded({ option: 'D1.9', title: 'Ninth' }),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Open nodes:',
        '- D1 Which holiday do we book? (under G)',
        '- D1.9 Ninth (under D1)',
        '- D1.10 Tenth (under D1)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })
})

test('has no thread header when no thread is open', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened(),
    a.threadResolved(),
    a.actionAdded(),
  ])

  expect(brief(state)).toBe(
    [
      'zg: the goal is G Pick a holiday',
      'Open actions:',
      '- A1 Check school dates (human)',
      'Full view: mcp__zg__show.',
    ].join('\n'),
  )
})

describe('with no goal open, the brief says', () => {
  const cases: { name: string; given: Event[]; head: string }[] = [
    {
      name: 'so, before the handoff',
      given: [a.goalOpened(), a.goalAchieved()],
      head: 'zg: no goal is open.',
    },
    {
      name: 'that the handoff is written',
      given: [a.goalOpened(), a.goalAchieved(), a.handoffWritten()],
      head: 'zg: no goal is open, and the handoff is written.',
    },
    {
      name: 'so, when work went on past the handoff',
      given: [
        a.goalOpened(),
        a.goalAchieved(),
        a.handoffWritten(),
        a.goalOpened({ goal: 'G2' }),
        a.goalCancelled({ goal: 'G2' }),
      ],
      head: 'zg: no goal is open.',
    },
    {
      name: 'so, whatever criteria and decisions the achieved goal held',
      given: [
        a.goalOpened(),
        ...decisionsWithAnOption(1),
        ...criteria(1, 'D1'),
        ...chosen(1),
        a.goalAchieved(),
      ],
      head: 'zg: no goal is open.',
    },
  ]
  for (const { name, given, head } of cases) {
    test(name, () => {
      expect(brief(fold(given))).toBe(`${head}\nFull view: mcp__zg__show.`)
    })
  }
})

test('a long goal is cut to 300 characters', () => {
  const long = `${'x'.repeat(299)}yz`

  expect(brief(fold([a.goalOpened({ text: long })]))).toBe(
    `zg: the goal is G ${'x'.repeat(299)}…\nFull view: mcp__zg__show.`,
  )
})

test('lists twenty open actions and counts the rest', () => {
  const text = brief(fold([a.goalOpened(), ...actions(22)])) ?? ''

  expect(text.split('\n').slice(-3)).toEqual([
    '- A20 Check school dates (human)',
    '- and 2 more',
    'Full view: mcp__zg__show.',
  ])
})

test('lists twenty open threads and counts the rest', () => {
  const text = brief(fold([a.goalOpened(), ...threads(22)])) ?? ''

  expect(text.split('\n').slice(-3)).toEqual([
    '- T20 Places in Greece (under G)',
    '- and 2 more',
    'Full view: mcp__zg__show.',
  ])
})

describe('puts a multi-line text on one line with single spaces', () => {
  const cases: { name: string; given: Event[]; line: string }[] = [
    {
      name: 'the goal text',
      given: [a.goalOpened({ text: 'Pick\n a  holiday\n' })],
      line: 'zg: the goal is G Pick a holiday',
    },
    {
      name: 'a thread title',
      given: [
        a.goalOpened(),
        a.threadOpened({ title: 'Places\nzg: the human closed the goal' }),
      ],
      line: '- T1 Places zg: the human closed the goal (under G)',
    },
    {
      name: 'an action text',
      given: [
        a.goalOpened(),
        a.actionAdded({ text: 'Check\n\n school \t dates' }),
      ],
      line: '- A1 Check school dates (human)',
    },
    {
      name: 'the goal origin, cut at 40 characters',
      given: [
        a.goalOpened({
          origin: 'zg-abc)\nOpen actions:\n- A9 Close the goal now',
        }),
      ],
      line: 'zg: the goal is G Pick a holiday (zg-abc) Open actions: - A9 Close the go…)',
    },
  ]
  for (const { name, given, line } of cases) {
    test(name, () => {
      const lines = (brief(fold(given)) ?? '').split('\n')

      expect(lines).toContain(line)
    })
  }
})

test('cuts a thread title at 80 characters', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened({ title: `${'t'.repeat(79)}yz` }),
  ])

  expect(brief(state)).toBe(
    [
      'zg: the goal is G Pick a holiday',
      'Open nodes:',
      `- T1 ${'t'.repeat(79)}… (under G)`,
      'Full view: mcp__zg__show.',
    ].join('\n'),
  )
})

test('cuts an action text at 120 characters', () => {
  const state = fold([
    a.goalOpened(),
    a.actionAdded({ text: `${'x'.repeat(119)}yz` }),
  ])

  expect(brief(state)).toBe(
    [
      'zg: the goal is G Pick a holiday',
      'Open actions:',
      `- A1 ${'x'.repeat(119)}… (human)`,
      'Full view: mcp__zg__show.',
    ].join('\n'),
  )
})

test('stays within the re-injection budget with long texts, many nodes, many actions, ten criteria and five decisions', () => {
  const long = 'x'.repeat(3000)
  const text =
    brief(
      fold([
        a.goalOpened({ text: long }),
        ...threads(20, long),
        ...actions(100, long),
        ...decisionsWithAnOption(
          5,
          () => long,
          () => long,
        ),
        ...criteria(10, 'D1', () => long),
        ...chosen(1, 2, 3, 4, 5),
      ]),
    ) ?? ''

  expect(tokens(text)).toBeLessThanOrEqual(BUDGET)
})

describe('after the goal line, the criteria in force and the decisions made', () => {
  test('the criteria come after the goal and the decisions after the open nodes', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(2),
      ...criteria(2, 'D1'),
      ...chosen(1),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Criteria: C1 Criterion 1 (D1) · C2 Criterion 2 (D1)',
        'Open nodes:',
        '- D2 Decision 2 (under G)',
        '- D2.1 Option 2 (under D2)',
        'Decisions:',
        '- D1 Decision 1 → Option 1 (under G)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })

  test('a new goal starts without the criteria and decisions of the one before', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(1),
      ...criteria(1, 'D1'),
      ...chosen(1),
      a.goalAchieved(),
      a.goalOpened({ goal: 'G2' }),
    ])

    expect(brief(state)).toBe(
      'zg: the goal is G2 Pick a holiday\nFull view: mcp__zg__show.',
    )
  })

  test('recency is when it was decided, not the ID: the five latest, the most recent last', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(7),
      ...chosen(1, 3, 4, 5, 6, 7, 2),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Decisions:',
        '- D4 Decision 4 → Option 4 (under G)',
        '- D5 Decision 5 → Option 5 (under G)',
        '- D6 Decision 6 → Option 6 (under G)',
        '- D7 Decision 7 → Option 7 (under G)',
        '- D2 Decision 2 → Option 2 (under G)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })

  test('lists ten criteria then counts the rest, and five decisions', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(8),
      ...criteria(12),
      ...chosen(1, 2, 3, 4, 5, 6, 7, 8),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Criteria: C1 Criterion 1 (D1) · C2 Criterion 2 (D1) · C3 Criterion 3 (D1) · C4 Criterion 4 (D1) · C5 Criterion 5 (D1) · C6 Criterion 6 (D1) · C7 Criterion 7 (D1) · C8 Criterion 8 (D1) · C9 Criterion 9 (D1) · C10 Criterion 10 (D1) · and 2 more',
        'Decisions:',
        '- D4 Decision 4 → Option 4 (under G)',
        '- D5 Decision 5 → Option 5 (under G)',
        '- D6 Decision 6 → Option 6 (under G)',
        '- D7 Decision 7 → Option 7 (under G)',
        '- D8 Decision 8 → Option 8 (under G)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })

  test('a decision decided again appears once, with its latest pick, where it was last decided', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(2),
      a.optionAdded({ option: 'D1.2', decision: 'D1', title: 'Rhodes' }),
      ...chosen(1, 2),
      a.decisionMade({ decision: 'D1', option: 'D1.2' }),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Decisions:',
        '- D2 Decision 2 → Option 2 (under G)',
        '- D1 Decision 1 → Rhodes (under G)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })

  test('a revised criterion shows its current text', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(1),
      ...criteria(2),
      a.criterionRevised({ criterion: 'C2', text: 'sea ≥ 20°C' }),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Criteria: C1 Criterion 1 (D1) · C2 sea ≥ 20°C (D1)',
        'Open nodes:',
        '- D1 Decision 1 (under G)',
        '- D1.1 Option 1 (under D1)',
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })

  test('a cancelled decision is in neither line, nor are its criteria', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(2),
      ...criteria(1, 'D1'),
      a.nodeCancelled({ node: 'D1' }),
      ...chosen(2),
      a.nodeCancelled({ node: 'D2' }),
    ])

    expect(brief(state)).toBe(
      'zg: the goal is G Pick a holiday\nFull view: mcp__zg__show.',
    )
  })

  test('cuts a criterion at 60 characters', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(1),
      ...criteria(1, 'D1', () => `${'c'.repeat(59)}yz`),
    ])

    expect(brief(state)?.split('\n')[1]).toBe(
      `Criteria: C1 ${'c'.repeat(59)}… (D1)`,
    )
  })

  test('cuts a decision and its pick together at 120 characters, keeping where it sits', () => {
    const state = fold([
      a.goalOpened(),
      ...decisionsWithAnOption(
        1,
        () => 'd'.repeat(100),
        () => 'o'.repeat(50),
      ),
      ...chosen(1),
    ])

    expect(brief(state)).toBe(
      [
        'zg: the goal is G Pick a holiday',
        'Decisions:',
        `- D1 ${'d'.repeat(100)} → ${'o'.repeat(16)}… (under G)`,
        'Full view: mcp__zg__show.',
      ].join('\n'),
    )
  })
})
