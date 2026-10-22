import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { brief } from './brief.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'

// zg-n27: re-injection stays within 2k tokens, at about four characters a
// token, however much the session holds.
const BUDGET = 2000

const tokens = (text: string) => Math.ceil(text.length / 4)

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

test('stays within the re-injection budget with long texts and many actions', () => {
  const long = 'x'.repeat(3000)
  const text =
    brief(fold([a.goalOpened({ text: long }), ...actions(100, long)])) ?? ''

  expect(tokens(text)).toBeLessThanOrEqual(BUDGET)
})
