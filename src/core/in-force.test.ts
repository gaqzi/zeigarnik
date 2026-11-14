import { describe, expect, test } from 'claude-code/testing'

import { AT, a } from './a.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'
import { hasOpenDecisionBelow, inForce } from './in-force.ts'

// Criteria flow down: in force for a node are the criteria on its ancestor
// decisions, itself included when it is a decision, that are open or
// decided. Derived from the log, never stored (zg-ww9).

const ids = (events: Event[], node: string) =>
  inForce(fold(events), node).map(criterion => criterion.id)

test('a criterion on the decision is in force for the decision, as the state holds it', () => {
  const given = [a.goalOpened(), a.decisionOpened(), a.criterionAdded()]

  expect(inForce(fold(given), 'D1')).toEqual([
    { id: 'C1', on: 'D1', versions: [{ text: 'Europe', at: AT }] },
  ])
})

describe('a criterion found deep applies to the decisions under the decision’s options', () => {
  const deep = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.decisionOpened({
      decision: 'D3',
      parent: 'D1.3',
      title: 'Which flights?',
    }),
    a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Direct' }),
    a.decisionOpened({ decision: 'D7', parent: 'D3.1', title: 'Which seats?' }),
    a.threadOpened({ thread: 'T6', parent: 'D1.3' }),
    a.decisionOpened({ decision: 'D4', title: 'Which hotel?' }),
    a.criterionAdded({ criterion: 'C1', on: 'D1' }),
    a.criterionAdded({ criterion: 'C2', on: 'D1', text: 'sea ≥ 18°C' }),
    a.criterionAdded({ criterion: 'C3', on: 'D7', text: 'quiet' }),
    a.criterionAdded({ criterion: 'C4', on: 'D1', text: 'transfer ≤ 30 min' }),
  ]

  test('the decision at the bottom has its own first, then the inherited, each in ID order', () => {
    expect(ids(deep, 'D7')).toEqual(['C3', 'C1', 'C2', 'C4'])
  })

  test('the inherited are in ID order across ancestors, not the nearest ancestor first', () => {
    const given = [
      ...deep,
      a.criterionAdded({ criterion: 'C5', on: 'D3', text: 'direct' }),
    ]

    expect(ids(given, 'D7')).toEqual(['C3', 'C1', 'C2', 'C4', 'C5'])
  })

  test('a decision in the middle has those of the decision above', () => {
    expect(ids(deep, 'D3')).toEqual(['C1', 'C2', 'C4'])
  })

  test('an option has those of its decision', () => {
    expect(ids(deep, 'D3.1')).toEqual(['C1', 'C2', 'C4'])
  })

  test('a thread under an option has those of the decision above', () => {
    expect(ids(deep, 'T6')).toEqual(['C1', 'C2', 'C4'])
  })

  test('a node beside the decision has none', () => {
    expect(ids(deep, 'D4')).toEqual([])
  })

  test('the goal has none', () => {
    expect(ids(deep, 'G')).toEqual([])
  })

  test('a decided ancestor’s criteria are still in force', () => {
    const given = [
      ...deep,
      a.decisionMade({ decision: 'D1', option: 'D1.3' }),
      a.decisionMade({ decision: 'D3', option: 'D3.1' }),
    ]

    expect(ids(given, 'D7')).toEqual(['C3', 'C1', 'C2', 'C4'])
  })
})

test('ID order is numeric, so C10 follows C2', () => {
  const given = [
    a.goalOpened(),
    a.decisionOpened(),
    a.criterionAdded({ criterion: 'C10' }),
    a.criterionAdded({ criterion: 'C2' }),
  ]

  expect(ids(given, 'D1')).toEqual(['C2', 'C10'])
})

describe('a cancelled decision’s criteria are not in force', () => {
  const cancelled = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.decisionOpened({
      decision: 'D3',
      parent: 'D1.3',
      title: 'Which flights?',
    }),
    a.criterionAdded(),
    a.nodeCancelled({ node: 'D1' }),
    a.nodeCancelled({ node: 'D3' }),
  ]

  test('for a decision under its option', () => {
    expect(ids(cancelled, 'D3')).toEqual([])
  })

  test('for the cancelled decision itself', () => {
    expect(ids(cancelled, 'D1')).toEqual([])
  })

  test('though an open decision beneath keeps its own', () => {
    const given = [
      ...cancelled.slice(0, 4),
      a.criterionAdded({ criterion: 'C1', on: 'D1' }),
      a.criterionAdded({ criterion: 'C2', on: 'D3', text: 'quiet' }),
      a.nodeCancelled({ node: 'D1' }),
    ]

    expect(ids(given, 'D3')).toEqual(['C2'])
  })

  test('as a merged decision’s are not either', () => {
    const given = [
      a.goalOpened(),
      a.decisionOpened(),
      a.decisionOpened({ decision: 'D2', title: 'Which flights?' }),
      a.criterionAdded(),
      a.nodeMerged({ from: ['D1'], into: 'D2' }),
    ]

    expect(ids(given, 'D1')).toEqual([])
  })
})

describe('an open decision below a node, through the options and decisions under it', () => {
  const below = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.1' }),
    a.decisionOpened({ decision: 'D2', parent: 'D1.1', title: 'Which lake?' }),
    a.optionAdded({ option: 'D2.1', decision: 'D2', title: 'Blue' }),
    a.decisionOpened({ decision: 'D3', parent: 'D2.1', title: 'Which cabin?' }),
    a.decisionOpened({ decision: 'D4', title: 'Which hotel?' }),
  ]
  const cases: { name: string; events: Event[]; on: string; open: boolean }[] =
    [
      { name: 'an open child decision', events: below, on: 'D1', open: true },
      {
        name: 'an open decision two levels down',
        events: [
          ...below,
          a.optionAdded({ option: 'D2.2', decision: 'D2', title: 'Red' }),
          a.decisionMade({ decision: 'D2', option: 'D2.2' }),
        ],
        on: 'D1',
        open: true,
      },
      {
        name: 'an open decision under a thread under an option',
        events: [
          a.goalOpened(),
          a.decisionOpened(),
          a.optionAdded({ option: 'D1.1' }),
          a.threadOpened({ thread: 'T2', parent: 'D1.1' }),
          a.decisionOpened({
            decision: 'D2',
            parent: 'T2',
            title: 'Which lake?',
          }),
        ],
        on: 'D1',
        open: true,
      },
      {
        name: 'a node with nothing under it',
        events: below,
        on: 'D3',
        open: false,
      },
      {
        name: 'only a sibling decision open',
        events: below,
        on: 'D4',
        open: false,
      },
      {
        name: 'only decided decisions below',
        events: [
          ...below,
          a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Pine' }),
          a.decisionMade({ decision: 'D3', option: 'D3.1' }),
          a.nodeCancelled({ node: 'D4' }),
          a.optionAdded({ option: 'D2.2', decision: 'D2', title: 'Red' }),
          a.decisionMade({ decision: 'D2', option: 'D2.2' }),
        ],
        on: 'D1',
        open: false,
      },
      {
        name: 'only a cancelled decision below',
        events: [...below.slice(0, 5), a.nodeCancelled({ node: 'D2' })],
        on: 'D1',
        open: false,
      },
    ]
  for (const { name, events, on, open } of cases) {
    test(`${name} is ${open ? '' : 'not '}an open decision below`, () => {
      expect(hasOpenDecisionBelow(fold(events), on)).toBe(open)
    })
  }
})
