import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { fold } from './evolve.ts'
import type { Event } from './events.ts'
import { waitingOnYou } from './waiting-on-you.ts'

const claudeSays = (node: string, at = a.nodeReplied().at) =>
  a.nodeReplied({ node, author: 'claude', text: 'Over to you', at })

const humanSays = (node: string, at = a.nodeReplied().at) =>
  a.nodeReplied({ node, author: 'human', text: 'Fine', at })

test('a session with nothing open waits on no one', () => {
  expect(waitingOnYou(fold([]))).toEqual([])
})

describe('the open threads whose latest reply is Claude’s', () => {
  const cases: { name: string; given: Event[]; waiting: string[] }[] = [
    {
      name: 'a thread with no reply does not wait',
      given: [a.goalOpened(), a.threadOpened()],
      waiting: [],
    },
    {
      name: 'a thread whose only reply is Claude’s waits',
      given: [a.goalOpened(), a.threadOpened(), claudeSays('T1')],
      waiting: ['T1'],
    },
    {
      name: 'a thread waits again when Claude speaks after the human',
      given: [
        a.goalOpened(),
        a.threadOpened(),
        claudeSays('T1'),
        humanSays('T1'),
        claudeSays('T1'),
      ],
      waiting: ['T1'],
    },
    {
      name: 'a resolved thread does not wait',
      given: [
        a.goalOpened(),
        a.threadOpened(),
        claudeSays('T1'),
        a.threadResolved(),
      ],
      waiting: [],
    },
    {
      name: 'a cancelled thread does not wait',
      given: [
        a.goalOpened(),
        a.threadOpened(),
        claudeSays('T1'),
        a.nodeCancelled(),
      ],
      waiting: [],
    },
    {
      name: 'an open decision does not wait',
      given: [a.goalOpened(), a.decisionOpened(), claudeSays('D1')],
      waiting: [],
    },
    {
      name: 'threads are listed in numeric ID order, T10 after T5',
      given: [
        a.goalOpened(),
        a.threadOpened({ thread: 'T10' }),
        a.threadOpened({ thread: 'T5' }),
        a.threadOpened({ thread: 'T2' }),
        claudeSays('T10'),
        claudeSays('T5'),
        claudeSays('T2'),
      ],
      waiting: ['T2', 'T5', 'T10'],
    },
    {
      name: 'a reply moved to another thread leaves the first and lands on the second',
      given: [
        a.goalOpened(),
        a.threadOpened({ thread: 'T1' }),
        a.threadOpened({ thread: 'T3' }),
        humanSays('T1', '2026-10-22T10:00:01.000Z'),
        claudeSays('T1', '2026-10-22T10:00:02.000Z'),
        a.replyMoved({
          node: 'T1',
          reply: '2026-10-22T10:00:02.000Z',
          to: 'T3',
        }),
      ],
      waiting: ['T3'],
    },
  ]

  for (const { name, given, waiting } of cases) {
    test(name, () => {
      expect(waitingOnYou(fold(given))).toEqual(waiting)
    })
  }
})

describe('the human answering Claude’s question on T5 takes it off the list', () => {
  const asked = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
    a.nodeReplied({
      node: 'T5',
      author: 'claude',
      text: 'Best Greek pick is 2h by bus from the airport. OK?',
      at: '2026-10-22T10:00:01.000Z',
    }),
  ]
  const cases: { name: string; text: string; waiting: string[] }[] = [
    { name: 'an acceptance', text: 'fine, two hours is OK', waiting: [] },
    {
      name: 'a rejection',
      text: 'no, two hours with the kids is a no',
      waiting: [],
    },
    { name: 'a follow-up question', text: 'what about ferries?', waiting: [] },
    { name: 'an acknowledgement', text: 'read it, thanks', waiting: [] },
  ]

  for (const { name, text, waiting } of cases) {
    test(`${name} does not leave T5 waiting`, () => {
      const answered = a.nodeReplied({
        node: 'T5',
        author: 'human',
        text,
        at: '2026-10-22T10:00:02.000Z',
      })

      expect(waitingOnYou(fold([...asked, answered]))).toEqual(waiting)
    })
  }
})
