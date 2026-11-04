import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'
import { followOn } from './follow-on.ts'

// Given the events so far and the events a settling tool just wrote, the
// lines the tool's result adds: one per affected parent, in event order.
const settle = (given: Event[], settling: Event[]): string[] =>
  followOn(fold([...given, ...settling]), settling)

// T2 under the goal, T6 under T2.
const t6UnderT2 = (): Event[] => [
  a.goalOpened(),
  a.threadOpened({ thread: 'T2', title: 'Where to stay' }),
  a.threadOpened({ thread: 'T6', parent: 'T2', title: 'Beach or town?' }),
]

const t7UnderT2 = (): Event[] => [
  a.threadOpened({ thread: 'T7', parent: 'T2', title: 'Hotel near the port?' }),
]

// D1 under the goal with option D1.3, and T8 under that option.
const t8UnderD1Option = (): Event[] => [
  a.goalOpened(),
  a.decisionOpened(),
  a.optionAdded({ option: 'D1.3', decision: 'D1', title: 'Paphos' }),
  a.threadOpened({ thread: 'T8', parent: 'D1.3', title: 'Transfer time?' }),
]

const nothingUnderT2 =
  'Nothing is open under T2 now: ask the human whether T2 can close.'

test('events that close nothing add no lines', () => {
  expect(settle(t6UnderT2(), [a.nodeReplied({ node: 'T6' })])).toEqual([])
})

describe('the last open child of a thread closes', () => {
  const closes: { name: string; given: Event[]; settling: Event[] }[] = [
    {
      name: 'resolved',
      given: t6UnderT2(),
      settling: [a.threadResolved({ thread: 'T6' })],
    },
    {
      name: 'cancelled',
      given: t6UnderT2(),
      settling: [a.nodeCancelled({ node: 'T6' })],
    },
    {
      name: 'merged into a thread elsewhere',
      given: [...t6UnderT2(), a.threadOpened({ thread: 'T9', title: 'Food' })],
      settling: [a.nodeMerged({ from: ['T6'], into: 'T9' })],
    },
  ]
  for (const { name, given, settling } of closes) {
    test(`it asks whether the parent can close when the child is ${name}`, () => {
      expect(settle(given, settling)).toEqual([nothingUnderT2])
    })
  }
})

test('a sibling still open is named when a thread closes', () => {
  expect(
    settle(
      [...t6UnderT2(), ...t7UnderT2()],
      [a.threadResolved({ thread: 'T6' })],
    ),
  ).toEqual(['T7 Hotel near the port? is still open under T2.'])
})

test('a decision made under a thread asks whether the thread can close', () => {
  expect(
    settle(
      [
        ...t6UnderT2(),
        a.decisionOpened({ decision: 'D3', parent: 'T6' }),
        a.optionAdded({ option: 'D3.1', decision: 'D3' }),
      ],
      [a.decisionMade({ decision: 'D3', option: 'D3.1' })],
    ),
  ).toEqual([
    'Nothing is open under T6 now: ask the human whether T6 can close.',
  ])
})

test('a thread directly under the goal adds no line when it closes', () => {
  expect(
    settle(
      [a.goalOpened(), a.threadOpened({ thread: 'T1' })],
      [a.threadResolved({ thread: 'T1' })],
    ),
  ).toEqual([])
})

test('two closes under the same parent add one line', () => {
  expect(
    settle(
      [
        ...t6UnderT2(),
        a.threadOpened({ thread: 'T7', parent: 'T2', title: 'Hotel?' }),
      ],
      [a.threadResolved({ thread: 'T6' }), a.nodeCancelled({ node: 'T7' })],
    ),
  ).toEqual([nothingUnderT2])
})

test('closes under different parents add a line each, in event order', () => {
  expect(
    settle(
      [
        ...t6UnderT2(),
        a.threadOpened({ thread: 'T3', title: 'Food' }),
        a.threadOpened({ thread: 'T4', parent: 'T3', title: 'Tavernas?' }),
      ],
      [a.threadResolved({ thread: 'T4' }), a.threadResolved({ thread: 'T6' })],
    ),
  ).toEqual([
    'Nothing is open under T3 now: ask the human whether T3 can close.',
    nothingUnderT2,
  ])
})

test('a close under a thread that is itself closed adds no line', () => {
  expect(
    settle(
      [...t6UnderT2(), a.nodeCancelled({ node: 'T2' })],
      [a.threadResolved({ thread: 'T6' })],
    ),
  ).toEqual([])
})

test('a decision decided again adds no line even when its parent thread has nothing open', () => {
  expect(
    settle(
      [
        a.goalOpened(),
        a.threadOpened({ thread: 'T2', title: 'Where to stay' }),
        a.decisionOpened({ decision: 'D1', parent: 'T2' }),
        a.optionAdded({ option: 'D1.3', decision: 'D1', title: 'Paphos' }),
        a.decisionMade({ decision: 'D1', option: 'D1.3' }),
        a.optionAdded({ option: 'D1.4', decision: 'D1', title: 'Rhodes' }),
      ],
      [a.decisionMade({ decision: 'D1', option: 'D1.4' })],
    ),
  ).toEqual([])
})

describe('a thread under an option of an open decision closes', () => {
  test('it asks for the human pick when nothing is open under any option', () => {
    expect(
      settle(t8UnderD1Option(), [a.threadResolved({ thread: 'T8' })]),
    ).toEqual([
      "Nothing is open under D1's options now: ask the human for D1's pick.",
    ])
  })

  test('it adds no line while something is still open under the same option', () => {
    expect(
      settle(
        [
          ...t8UnderD1Option(),
          a.threadOpened({
            thread: 'T9',
            parent: 'D1.3',
            title: 'Beach nearby?',
          }),
        ],
        [a.threadResolved({ thread: 'T8' })],
      ),
    ).toEqual([])
  })

  test('it adds no line while another option still has something open', () => {
    expect(
      settle(
        [
          ...t8UnderD1Option(),
          a.optionAdded({ option: 'D1.4', decision: 'D1', title: 'Rhodes' }),
          a.threadOpened({
            thread: 'T9',
            parent: 'D1.4',
            title: 'Flights?',
          }),
        ],
        [a.threadResolved({ thread: 'T8' })],
      ),
    ).toEqual([])
  })
})
