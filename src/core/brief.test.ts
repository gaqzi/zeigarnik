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
      'Open threads:',
      '- T1 Places in Greece (under G)',
      '- T3 Rhodes or Crete (under T1)',
      'Open actions:',
      '- A1 Check school dates (human)',
      'Full view: mcp__zg__show.',
    ].join('\n'),
  )
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
      'Open threads:',
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

test('stays within the re-injection budget with long texts, many threads and many actions', () => {
  const long = 'x'.repeat(3000)
  const text =
    brief(
      fold([
        a.goalOpened({ text: long }),
        ...threads(20, long),
        ...actions(100, long),
      ]),
    ) ?? ''

  expect(tokens(text)).toBeLessThanOrEqual(BUDGET)
})
