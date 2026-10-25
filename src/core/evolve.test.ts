import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
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
