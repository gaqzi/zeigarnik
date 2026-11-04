import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'
import { replyRows } from './reply-rows.ts'

// zg-bam.15: typing T at the start of a line in the reply box offers the open
// threads, so the human answers each in turn without remembering the numbers.
// The token is the run of characters ending at the cursor.

const places = a.threadOpened({ thread: 'T1', title: 'Places in Greece' })
const getting = a.threadOpened({ thread: 'T2', title: 'Getting there' })
const staying = a.threadOpened({ thread: 'T3', title: 'Where to stay' })
const food = a.threadOpened({ thread: 'T5', title: 'Food' })
const flights = a.threadOpened({ thread: 'T6', title: 'Flights out' })

const typing = (
  overrides: Partial<{
    given: Event[]
    text: string
    cursor: number
    token: string
  }> = {},
) => ({
  given: [a.goalOpened(), places],
  text: 'T',
  cursor: 1,
  token: 'T',
  ...overrides,
})

const row = (
  overrides: Partial<ReturnType<typeof replyRows>[number]> = {},
) => ({
  text: 'T1: ',
  label: 'T1',
  description: 'Places in Greece',
  ...overrides,
})

const rowsFor = (t: ReturnType<typeof typing>) =>
  replyRows(fold(t.given), t.text, t.cursor, t.token)

test('typing T at the start of an empty box offers the open thread', () => {
  expect(rowsFor(typing())).toEqual([row()])
})

describe('which threads are offered', () => {
  const cases: {
    name: string
    typed: ReturnType<typeof typing>
    rows: ReturnType<typeof row>[]
  }[] = [
    {
      name: 'several are open, in ID order',
      typed: typing({
        given: [a.goalOpened(), places, getting, staying],
      }),
      rows: [
        row(),
        row({ text: 'T2: ', label: 'T2', description: 'Getting there' }),
        row({ text: 'T3: ', label: 'T3', description: 'Where to stay' }),
      ],
    },
    {
      name: 'one is resolved',
      typed: typing({
        given: [a.goalOpened(), places, getting, a.threadResolved()],
      }),
      rows: [row({ text: 'T2: ', label: 'T2', description: 'Getting there' })],
    },
    {
      name: 'one is cancelled',
      typed: typing({
        given: [a.goalOpened(), places, getting, a.nodeCancelled()],
      }),
      rows: [row({ text: 'T2: ', label: 'T2', description: 'Getting there' })],
    },
    {
      name: 'one is merged into another',
      typed: typing({
        given: [
          a.goalOpened(),
          places,
          getting,
          a.nodeMerged({ from: ['T1'], into: 'T2' }),
        ],
      }),
      rows: [row({ text: 'T2: ', label: 'T2', description: 'Getting there' })],
    },
    {
      name: 'a decision with an option is open beside the thread',
      typed: typing({
        given: [a.goalOpened(), places, a.decisionOpened(), a.optionAdded()],
      }),
      rows: [row()],
    },
  ]
  for (const { name, typed, rows } of cases) {
    test(`offers the right threads when ${name}`, () => {
      expect(rowsFor(typed)).toEqual(rows)
    })
  }
})

describe('what the token matches', () => {
  const several = [a.goalOpened(), places, getting, staying, food]
  const cases: {
    name: string
    typed: ReturnType<typeof typing>
    rows: ReturnType<typeof row>[]
  }[] = [
    {
      name: 'a lower case t offers the rows in upper case',
      typed: typing({ text: 't', token: 't' }),
      rows: [row()],
    },
    {
      name: 'a digit narrows to the IDs that start with it',
      typed: typing({
        given: several,
        text: 'T5',
        cursor: 2,
        token: 'T5',
      }),
      rows: [row({ text: 'T5: ', label: 'T5', description: 'Food' })],
    },
    {
      name: 'a lower case t and a digit narrow the same',
      typed: typing({
        given: several,
        text: 't5',
        cursor: 2,
        token: 't5',
      }),
      rows: [row({ text: 'T5: ', label: 'T5', description: 'Food' })],
    },
    {
      name: 'a lower case t after a named thread skips it and the resolved ones',
      typed: typing({
        given: [
          a.goalOpened(),
          places,
          getting,
          staying,
          a.threadOpened({ thread: 'T4', title: 'Places in Malta' }),
          food,
          flights,
          a.threadResolved({ thread: 'T2' }),
          a.threadResolved({ thread: 'T3' }),
          a.threadResolved({ thread: 'T4' }),
        ],
        text: 'T5: skip the bus village\nt',
        cursor: 26,
        token: 't',
      }),
      rows: [
        row(),
        row({ text: 'T6: ', label: 'T6', description: 'Flights out' }),
      ],
    },
    {
      name: 'the token is a word that is not T and digits',
      typed: typing({ text: 'To', cursor: 2, token: 'To' }),
      rows: [],
    },
    {
      name: 'the token is another letter',
      typed: typing({ text: 'A', token: 'A' }),
      rows: [],
    },
    {
      name: 'the token is empty',
      typed: typing({ text: '', cursor: 0, token: '' }),
      rows: [],
    },
  ]
  for (const { name, typed, rows } of cases) {
    test(`offers the right rows when ${name}`, () => {
      expect(rowsFor(typed)).toEqual(rows)
    })
  }
})

describe('where the token stands in the box', () => {
  const cases: {
    name: string
    typed: ReturnType<typeof typing>
    rows: ReturnType<typeof row>[]
  }[] = [
    {
      name: 'on the second line',
      typed: typing({
        given: [a.goalOpened(), places, getting],
        text: 'T1: no\nT',
        cursor: 8,
        token: 'T',
      }),
      rows: [row({ text: 'T2: ', label: 'T2', description: 'Getting there' })],
    },
    {
      name: 'on a line after a blank line',
      typed: typing({
        given: [a.goalOpened(), places, getting],
        text: 'T1: no\n\nT',
        cursor: 9,
        token: 'T',
      }),
      rows: [row({ text: 'T2: ', label: 'T2', description: 'Getting there' })],
    },
    {
      name: 'in the middle of a line',
      typed: typing({
        text: 'T1: take the bus t',
        cursor: 18,
        token: 't',
      }),
      rows: [],
    },
    {
      name: 'in the middle of a later line',
      typed: typing({ text: 'T1: no\nbut t', cursor: 12, token: 't' }),
      rows: [],
    },
    {
      name: 'the token ends a word on the first line',
      typed: typing({ text: 'T1: take the bus at', cursor: 19, token: 'at' }),
      rows: [],
    },
    {
      name: 'the token ends a word on a later line',
      typed: typing({ text: 'T1: no\nbutt', cursor: 11, token: 'butt' }),
      rows: [],
    },
    {
      name: 'after leading spaces',
      typed: typing({ text: '  T', cursor: 3, token: 'T' }),
      rows: [],
    },
  ]
  for (const { name, typed, rows } of cases) {
    test(`offers the right rows when the token stands ${name}`, () => {
      expect(rowsFor(typed)).toEqual(rows)
    })
  }
})

describe('threads the draft already names', () => {
  const several = [a.goalOpened(), places, getting, staying]
  const cases: {
    name: string
    typed: ReturnType<typeof typing>
    rows: ReturnType<typeof row>[]
  }[] = [
    {
      name: 'on a line before the cursor',
      typed: typing({
        given: several,
        text: 'T1: no\nT',
        cursor: 8,
        token: 'T',
      }),
      rows: [
        row({ text: 'T2: ', label: 'T2', description: 'Getting there' }),
        row({ text: 'T3: ', label: 'T3', description: 'Where to stay' }),
      ],
    },
    {
      name: 'on a line after the cursor',
      typed: typing({
        given: several,
        text: 'T\nT2: yes',
        cursor: 1,
        token: 'T',
      }),
      rows: [
        row(),
        row({ text: 'T3: ', label: 'T3', description: 'Where to stay' }),
      ],
    },
    {
      name: 'in lower case',
      typed: typing({
        given: several,
        text: 'T\nt2: yes',
        cursor: 1,
        token: 'T',
      }),
      rows: [
        row(),
        row({ text: 'T3: ', label: 'T3', description: 'Where to stay' }),
      ],
    },
    {
      name: 'in the middle of a line before the cursor',
      typed: typing({
        given: several,
        text: 'so skip T2 for now\nT',
        cursor: 20,
        token: 'T',
      }),
      rows: [
        row(),
        row({ text: 'T3: ', label: 'T3', description: 'Where to stay' }),
      ],
    },
    {
      name: 'in the middle of a line after the cursor',
      typed: typing({
        given: several,
        text: 'T\nbut T2 matters',
        cursor: 1,
        token: 'T',
      }),
      rows: [
        row(),
        row({ text: 'T3: ', label: 'T3', description: 'Where to stay' }),
      ],
    },
    {
      name: 'on the cursor line after the cursor',
      typed: typing({
        given: several,
        text: 'T and T2',
        cursor: 1,
        token: 'T',
      }),
      rows: [
        row(),
        row({ text: 'T3: ', label: 'T3', description: 'Where to stay' }),
      ],
    },
    {
      name: 'only by the token itself',
      typed: typing({ given: several, text: 'T1', cursor: 2, token: 'T1' }),
      rows: [row()],
    },
  ]
  for (const { name, typed, rows } of cases) {
    test(`leaves out the named threads when the draft names one ${name}`, () => {
      expect(rowsFor(typed)).toEqual(rows)
    })
  }

  test('offers nothing when the only open thread is already named', () => {
    expect(
      rowsFor(typing({ text: 'T1: done\nT', cursor: 10, token: 'T' })),
    ).toEqual([])
  })
})
