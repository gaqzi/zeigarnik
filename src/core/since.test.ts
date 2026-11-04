import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import type { Event } from './events.ts'
import { since } from './since.ts'

// The story's background: goal G, decision D1 with option D1.3 Paphos, thread
// T8 under D1.3, and the human's reply on D1 as the last thing before the
// changes under test.
const beforeReply = [
  a.goalOpened({ text: 'Pick our end-of-May beach holiday' }),
  a.decisionOpened({ decision: 'D1', title: 'Which holiday do we book?' }),
  a.optionAdded({ option: 'D1.3', decision: 'D1', title: 'Paphos' }),
  a.threadOpened({
    thread: 'T8',
    parent: 'D1.3',
    title: 'Check Paphos flights',
  }),
]

const reply = a.nodeReplied({
  node: 'D1',
  author: 'human',
  text: 'what’s the cheapest week?',
})

const session = (...after: Event[]): Event[] => [
  ...beforeReply,
  reply,
  ...after,
]

const t8Resolved = a.threadResolved({
  thread: 'T8',
  outcome: 'direct, Thursday and Sunday',
})

const c5Added = a.criterionAdded({
  criterion: 'C5',
  on: 'D1',
  text: 'transfer ≤ 30 min',
  origin: 'T8',
})

test('nothing changed since the human last wrote on the node is said so', () => {
  expect(since(session(), 'D1')).toBe(
    'Nothing has changed on D1 since you last wrote on it.',
  )
})

test('a child closed and a criterion added are listed in log order', () => {
  expect(since(session(t8Resolved, c5Added), 'D1')).toBe(
    'Since you last wrote on D1: T8 resolved → direct, Thursday and Sunday · C5 transfer ≤ 30 min added (from T8)',
  )
})

describe('each kind of change is named in its own words', () => {
  const cases = [
    {
      name: 'a child thread resolved',
      after: [t8Resolved],
      named: 'T8 resolved → direct, Thursday and Sunday',
    },
    {
      name: 'a child thread cancelled',
      after: [a.nodeCancelled({ node: 'T8', reason: 'flights are too dear' })],
      named: 'T8 cancelled → flights are too dear',
    },
    {
      name: 'a child thread merged into another',
      after: [
        a.threadOpened({
          thread: 'T9',
          parent: 'D1.3',
          title: 'Any flights to Paphos?',
        }),
        a.nodeMerged({ from: ['T8'], into: 'T9' }),
      ],
      named: 'T8 merged into T9',
    },
    {
      name: 'a child decision decided',
      after: [
        a.decisionOpened({
          decision: 'D2',
          parent: 'D1.3',
          title: 'Which airline?',
        }),
        a.optionAdded({ option: 'D2.1', decision: 'D2', title: 'Aegean' }),
        a.decisionMade({ decision: 'D2', option: 'D2.1' }),
      ],
      named: 'D2 decided → D2.1 Aegean',
    },
    {
      name: 'a criterion added without an origin',
      after: [
        a.criterionAdded({ criterion: 'C5', on: 'D1', text: 'sea view' }),
      ],
      named: 'C5 sea view added',
    },
    {
      name: 'a criterion revised',
      after: [
        a.criterionRevised({
          criterion: 'C5',
          text: 'transfer ≤ 45 min',
          origin: 'T8',
        }),
      ],
      named: 'C5 revised → transfer ≤ 45 min',
      before: [
        a.criterionAdded({
          criterion: 'C5',
          on: 'D1',
          text: 'transfer ≤ 30 min',
        }),
      ],
    },
  ]

  for (const { name, after, named, before = [] } of cases) {
    test(name, () => {
      const events = [...beforeReply, ...before, reply, ...after]

      expect(since(events, 'D1')).toBe(`Since you last wrote on D1: ${named}`)
    })
  }
})

describe('every change after the anchor is listed in log order, none collapsed', () => {
  const cases = [
    {
      name: 'a decision decided and then decided again',
      after: [
        a.decisionOpened({
          decision: 'D2',
          parent: 'D1.3',
          title: 'Which airline?',
        }),
        a.optionAdded({ option: 'D2.1', decision: 'D2', title: 'Aegean' }),
        a.optionAdded({ option: 'D2.2', decision: 'D2', title: 'Ryanair' }),
        a.decisionMade({ decision: 'D2', option: 'D2.1' }),
        a.decisionMade({ decision: 'D2', option: 'D2.2' }),
      ],
      named: 'D2 decided → D2.1 Aegean · D2 decided → D2.2 Ryanair',
    },
    {
      name: 'a thread resolved and then cancelled',
      after: [
        t8Resolved,
        a.nodeCancelled({ node: 'T8', reason: 'flights are too dear' }),
      ],
      named:
        'T8 resolved → direct, Thursday and Sunday · T8 cancelled → flights are too dear',
    },
    {
      name: 'a criterion added and then revised',
      after: [
        c5Added,
        a.criterionRevised({
          criterion: 'C5',
          text: 'transfer ≤ 45 min',
          origin: 'T8',
        }),
      ],
      named:
        'C5 transfer ≤ 30 min added (from T8) · C5 revised → transfer ≤ 45 min',
    },
  ]

  for (const { name, after, named } of cases) {
    test(name, () => {
      expect(since(session(...after), 'D1')).toBe(
        `Since you last wrote on D1: ${named}`,
      )
    })
  }
})

test('a grandchild closed is not listed, only the node’s children and its options’ children', () => {
  const events = session(
    a.threadOpened({ thread: 'T11', parent: 'T8', title: 'Which day?' }),
    a.threadResolved({ thread: 'T11', outcome: 'Thursday' }),
  )

  expect(since(events, 'D1')).toBe(
    'Nothing has changed on D1 since you last wrote on it.',
  )
})

describe('the anchor is the human’s latest reply on the node in the folded state', () => {
  const first = a.nodeReplied({
    node: 'D1',
    author: 'human',
    text: 'what’s the cheapest week?',
    at: '2026-10-22T10:01:00.000Z',
  })
  const onT8 = a.nodeReplied({
    node: 'T8',
    author: 'human',
    text: 'any news?',
    at: '2026-10-22T10:03:00.000Z',
  })

  test('a human reply moved off the node no longer anchors it', () => {
    const events = [
      ...beforeReply,
      t8Resolved,
      first,
      a.replyMoved({ node: 'D1', reply: first.at, to: 'T8' }),
    ]

    expect(since(events, 'D1')).toBe(
      'Since D1 opened: T8 resolved → direct, Thursday and Sunday',
    )
  })

  test('a human reply moved onto the node anchors it', () => {
    const events = [
      ...beforeReply,
      first,
      t8Resolved,
      onT8,
      c5Added,
      a.replyMoved({ node: 'T8', reply: onT8.at, to: 'D1' }),
    ]

    expect(since(events, 'D1')).toBe(
      'Since you last wrote on D1: C5 transfer ≤ 30 min added (from T8)',
    )
  })
})

test('a change before the human’s reply is not listed', () => {
  const events = [...beforeReply, t8Resolved, reply]

  expect(since(events, 'D1')).toBe(
    'Nothing has changed on D1 since you last wrote on it.',
  )
})

test('only the human’s latest reply on the node is the anchor, by log position', () => {
  const events = [
    ...beforeReply,
    reply,
    t8Resolved,
    a.nodeReplied({ node: 'D1', author: 'claude', text: 'T8 is in' }),
    a.nodeReplied({ node: 'T8', author: 'human', text: 'good' }),
    c5Added,
  ]

  expect(since(events, 'D1')).toBe(
    'Since you last wrote on D1: T8 resolved → direct, Thursday and Sunday · C5 transfer ≤ 30 min added (from T8)',
  )
})

test('a change under an unrelated node is not listed', () => {
  const events = session(
    a.threadOpened({ thread: 'T9', parent: 'G', title: 'Car hire?' }),
    a.threadResolved({ thread: 'T9', outcome: 'a Fiat' }),
  )

  expect(since(events, 'D1')).toBe(
    'Nothing has changed on D1 since you last wrote on it.',
  )
})

test('a criterion on an ancestor decision in force on the node counts', () => {
  const events = [
    ...beforeReply,
    a.nodeReplied({ node: 'T8', author: 'human', text: 'any news?' }),
    c5Added,
  ]

  expect(since(events, 'T8')).toBe(
    'Since you last wrote on T8: C5 transfer ≤ 30 min added (from T8)',
  )
})

test('a node the human never wrote on is counted from when it opened', () => {
  const events = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T9', parent: 'G', title: 'Car hire?' }),
    a.threadOpened({
      thread: 'T10',
      parent: 'T9',
      title: 'Child seats?',
    }),
    a.threadResolved({ thread: 'T10', outcome: 'included' }),
  ]

  expect(since(events, 'T9')).toBe('Since T9 opened: T10 resolved → included')
})

test('a node the human never wrote on and nothing changed under says so', () => {
  const events = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T9', parent: 'G', title: 'Car hire?' }),
  ]

  expect(since(events, 'T9')).toBe('Nothing has changed on T9 since it opened.')
})

describe('a node the human never wrote on is counted from its opening event', () => {
  const t9 = a.threadOpened({ thread: 'T9', parent: 'D1', title: 'Car hire?' })

  test('a criterion in force added after the thread opened is listed', () => {
    const events = [...beforeReply, t9, c5Added]

    expect(since(events, 'T9')).toBe(
      'Since T9 opened: C5 transfer ≤ 30 min added (from T8)',
    )
  })

  test('a criterion in force added before the thread opened is not listed', () => {
    const events = [...beforeReply, c5Added, t9]

    expect(since(events, 'T9')).toBe(
      'Nothing has changed on T9 since it opened.',
    )
  })

  test('a criterion added before an option opened is not listed, a child closed after is', () => {
    const events = [
      a.goalOpened(),
      a.decisionOpened({ decision: 'D1', title: 'Which holiday do we book?' }),
      c5Added,
      a.optionAdded({ option: 'D1.3', decision: 'D1', title: 'Paphos' }),
      a.threadOpened({ thread: 'T8', parent: 'D1.3', title: 'Flights' }),
      t8Resolved,
    ]

    expect(since(events, 'D1.3')).toBe(
      'Since D1.3 opened: T8 resolved → direct, Thursday and Sunday',
    )
  })

  test('a criterion added after a decision opened is listed', () => {
    const events = [
      a.goalOpened(),
      a.decisionOpened({ decision: 'D1', title: 'Which holiday do we book?' }),
      c5Added,
    ]

    expect(since(events, 'D1')).toBe(
      'Since D1 opened: C5 transfer ≤ 30 min added (from T8)',
    )
  })
})

describe('the anchor is the human’s reply itself, found by when, who and what', () => {
  const at = '2026-10-22T10:01:00.000Z'
  const second = a.nodeReplied({
    node: 'D1',
    author: 'human',
    text: 'and the cheapest day?',
    at: '2026-10-22T10:05:00.000Z',
  })
  const first = a.nodeReplied({
    node: 'D1',
    author: 'human',
    text: 'what’s the cheapest week?',
    at,
  })

  test('with two human replies on the node and a change between them, none is listed', () => {
    const events = [...beforeReply, first, t8Resolved, second]

    expect(since(events, 'D1')).toBe(
      'Nothing has changed on D1 since you last wrote on it.',
    )
  })

  test('with two human replies on the node and a change after the second, only that is listed', () => {
    const events = [...beforeReply, first, t8Resolved, second, c5Added]

    expect(since(events, 'D1')).toBe(
      'Since you last wrote on D1: C5 transfer ≤ 30 min added (from T8)',
    )
  })

  const twins = [
    { name: 'claude’s reply on another node', author: 'claude' as const },
    { name: 'the human’s reply on another node', author: 'human' as const },
  ]

  for (const { name, author } of twins) {
    test(`${name} sharing its at and logged before it does not move the anchor`, () => {
      const twin = a.nodeReplied({
        node: 'T8',
        author,
        text: 'a different reply',
        at,
      })
      const events = [...beforeReply, twin, t8Resolved, first]

      expect(since(events, 'D1')).toBe(
        'Nothing has changed on D1 since you last wrote on it.',
      )
    })
  }
})
