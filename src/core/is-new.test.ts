import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { fold } from './evolve.ts'
import type { Event } from './events.ts'
import { isNew } from './is-new.ts'

describe('a thread is new until the human has replied on it', () => {
  const rows: { name: string; events: Event[]; isNew: boolean }[] = [
    {
      name: 'it is open and only Claude has replied',
      events: [a.nodeReplied({ author: 'claude', text: 'Noted' })],
      isNew: true,
    },
    {
      name: 'it is open and the human has replied',
      events: [
        a.nodeReplied({ author: 'claude', text: 'Noted' }),
        a.nodeReplied(),
      ],
      isNew: false,
    },
    {
      name: 'it is open and the human nested it',
      events: [a.nodeMoved({ node: 'T1', parent: 'G' })],
      isNew: false,
    },
    {
      name: 'it is open and Claude nested it',
      events: [a.nodeMoved({ node: 'T1', parent: 'G', source: 'claude' })],
      isNew: true,
    },
    {
      name: 'the human merged threads into it in chat',
      events: [
        a.threadOpened({ thread: 'T2' }),
        a.nodeMerged({ from: ['T2'], into: 'T1', source: 'chat' }),
      ],
      isNew: false,
    },
    {
      name: 'the human merged threads into it in the dialog',
      events: [
        a.threadOpened({ thread: 'T2' }),
        a.nodeMerged({ from: ['T2'], into: 'T1', source: 'dialog' }),
      ],
      isNew: false,
    },
    {
      name: 'Claude merged threads into it',
      events: [
        a.threadOpened({ thread: 'T2' }),
        a.nodeMerged({ from: ['T2'], into: 'T1', source: 'claude' }),
      ],
      isNew: true,
    },
    {
      name: 'it is resolved and was never replied to',
      events: [a.threadResolved()],
      isNew: false,
    },
    {
      name: 'it is open and has no replies at all',
      events: [],
      isNew: true,
    },
  ]
  for (const row of rows) {
    test(`${row.isNew ? 'new' : 'not new'} when ${row.name}`, () => {
      const state = fold([a.goalOpened(), a.threadOpened(), ...row.events])

      expect(isNew(state.nodes[0]!, state)).toBe(row.isNew)
    })
  }
})
