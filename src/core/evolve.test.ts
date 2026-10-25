import { describe, expect, test } from 'claude-code/testing'

import { AT, a } from './a.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'

// zg-8ex: logs outlive builds. A log written by a newer zg may hold events
// this build doesn't know; it still replays what it does.

test('an event this build does not know changes nothing', () => {
  const unknown = {
    type: 'SomethingNobodyKnows',
    at: a.goalOpened().at,
  } as unknown as Event

  expect(fold([a.goalOpened(), unknown])).toEqual(fold([a.goalOpened()]))
})

describe('a NodeMerged this build cannot read changes nothing', () => {
  const given = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T1' }),
    a.threadOpened({ thread: 'T4' }),
  ]
  const unreadable: { name: string; from: unknown }[] = [
    { name: 'with no from', from: undefined },
    { name: 'with from a string, not a list', from: 'T4' },
  ]
  for (const { name, from } of unreadable) {
    test(`a merge ${name}`, () => {
      const merged = {
        ...a.nodeMerged({ into: 'T1' }),
        from,
      } as unknown as Event

      expect(fold([...given, merged])).toEqual(fold(given))
    })
  }
})

describe('a moved reply', () => {
  const first = '2026-10-22T10:00:01.000Z'
  const second = '2026-10-22T10:00:02.000Z'
  const third = '2026-10-22T10:00:03.000Z'
  const given = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T3' }),
    a.threadOpened({ thread: 'T5' }),
    a.nodeReplied({ node: 'T5', author: 'claude', text: 'Noted', at: first }),
    a.nodeReplied({ node: 'T5', text: 'that was about Spain', at: second }),
    a.nodeReplied({ node: 'T5', author: 'claude', text: 'Right', at: third }),
  ]

  test('is on the new thread and keeps its place in log order', () => {
    expect(fold([...given, a.replyMoved({ reply: second })]).replies).toEqual([
      { node: 'T5', author: 'claude', text: 'Noted', at: first },
      { node: 'T3', author: 'human', text: 'that was about Spain', at: second },
      { node: 'T5', author: 'claude', text: 'Right', at: third },
    ])
  })

  test('naming a reply that is not on the thread changes nothing', () => {
    const moved = a.replyMoved({ reply: '2026-10-22T10:00:09.000Z' })

    expect(fold([...given, moved])).toEqual(fold(given))
  })

  test('naming a reply on another thread changes nothing', () => {
    const moved = a.replyMoved({ node: 'T3', reply: second, to: 'T5' })

    expect(fold([...given, moved])).toEqual(fold(given))
  })
})

describe('a decision and its options end together, derived from the decision’s events (zg-ww9)', () => {
  const holiday = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
  ]
  // The options' standing alone: a reason that was not said is absent.
  const options = (events: Event[]) =>
    fold(events)
      .nodes.filter(node => node.kind === 'option')
      .map(({ id, status, reason }) => ({ id, status, reason }))

  test('after a pick the option picked is chosen, the open others not chosen, and one dropped before stays cancelled with its own reason', () => {
    expect(options([...holiday, a.decisionMade()])).toEqual([
      { id: 'D1.1', status: 'cancelled', reason: 'too far with the kids' },
      { id: 'D1.2', status: 'not chosen', reason: undefined },
      { id: 'D1.3', status: 'chosen', reason: undefined },
    ])
  })

  test('after a pick the decision is decided, with the option and the words behind it', () => {
    const decision = fold([...holiday, a.decisionMade()]).nodes.find(
      node => node.id === 'D1',
    )

    expect({
      status: decision?.status,
      picks: (decision as { picks?: unknown }).picks,
    }).toEqual({
      status: 'decided',
      picks: [
        {
          option: 'D1.3',
          source: 'chat',
          reason: 'Paphos then, the 20 min transfer settles it',
          at: a.decisionMade().at,
        },
      ],
    })
  })

  test('after a second pick the earlier option is not chosen, the new one chosen, and both picks are kept in order', () => {
    const given = [
      ...holiday,
      a.decisionMade(),
      a.decisionMade({
        option: 'D1.2',
        reason: 'Paphos flights got cancelled, Costa del Sol it is',
      }),
    ]
    const decision = fold(given).nodes.find(node => node.id === 'D1')

    expect({
      options: options(given),
      status: decision?.status,
      picks: decision?.picks?.map(({ option, reason }) => ({ option, reason })),
    }).toEqual({
      options: [
        { id: 'D1.1', status: 'cancelled', reason: 'too far with the kids' },
        { id: 'D1.2', status: 'chosen', reason: undefined },
        { id: 'D1.3', status: 'not chosen', reason: undefined },
      ],
      status: 'decided',
      picks: [
        {
          option: 'D1.3',
          reason: 'Paphos then, the 20 min transfer settles it',
        },
        {
          option: 'D1.2',
          reason: 'Paphos flights got cancelled, Costa del Sol it is',
        },
      ],
    })
  })

  test('when the decision is cancelled its open options are cancelled with it and carry no reason, while one dropped before keeps its own', () => {
    expect(options([...holiday, a.nodeCancelled({ node: 'D1' })])).toEqual([
      { id: 'D1.1', status: 'cancelled', reason: 'too far with the kids' },
      { id: 'D1.2', status: 'cancelled', reason: undefined },
      { id: 'D1.3', status: 'cancelled', reason: undefined },
    ])
  })
})

describe('a criterion', () => {
  const decided = [a.goalOpened(), a.decisionOpened()]

  test('is kept on its decision with its text', () => {
    expect(fold([...decided, a.criterionAdded()]).criteria).toEqual([
      { id: 'C1', on: 'D1', versions: [{ text: 'Europe', at: AT }] },
    ])
  })

  test('keeps the origin it came up in inside its version', () => {
    expect(
      fold([...decided, a.criterionAdded({ origin: 'D2' })]).criteria,
    ).toEqual([
      {
        id: 'C1',
        on: 'D1',
        versions: [{ text: 'Europe', origin: 'D2', at: AT }],
      },
    ])
  })

  test('a session without one has none', () => {
    expect(fold(decided).criteria).toEqual([])
  })
})

describe('a criterion revised', () => {
  const LATER = '2026-10-23T09:30:00.000Z'

  const revised = [
    a.goalOpened(),
    a.decisionOpened(),
    a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
  ]

  test('gains a version, the earlier ones kept', () => {
    expect(
      fold([...revised, a.criterionRevised({ at: LATER })]).criteria,
    ).toEqual([
      {
        id: 'C2',
        on: 'D1',
        versions: [
          { text: 'sea ≥ 18°C', at: AT },
          { text: 'sea ≥ 20°C', origin: 'T5', at: LATER },
        ],
      },
    ])
  })

  test('twice keeps every version in log order', () => {
    expect(
      fold([
        ...revised,
        a.criterionRevised({ text: 'sea ≥ 19°C', origin: 'G' }),
        a.criterionRevised(),
      ]).criteria[0]?.versions.map(version => version.text),
    ).toEqual(['sea ≥ 18°C', 'sea ≥ 19°C', 'sea ≥ 20°C'])
  })
})
