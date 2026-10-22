import { expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'

// zg-8ex: logs outlive builds. A log written by a newer zg may hold events
// this build doesn't know; it still replays what it does.

test('an event this build does not know changes nothing', () => {
  const unknown = {
    type: 'ThreadOpened',
    at: a.goalOpened().at,
  } as unknown as Event

  expect(fold([a.goalOpened(), unknown])).toEqual(fold([a.goalOpened()]))
})
