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

// zg-bam.16: A, D and C list the existing actions, decisions and criteria of
// that kind, each with its text. Items of every status are listed; a
// decision's options are not.

const checkDates = a.actionAdded({ action: 'A1', text: 'Check school dates' })
const bookFlights = a.actionAdded({ action: 'A2', text: 'Book the flights' })
const holiday = a.decisionOpened({
  decision: 'D1',
  title: 'Which holiday do we book?',
})
const transfer = a.decisionOpened({
  decision: 'D2',
  title: 'How do we get there?',
})
const europe = a.criterionAdded({ criterion: 'C1', on: 'D1', text: 'Europe' })
const sea = a.criterionAdded({ criterion: 'C2', on: 'D1', text: 'sea ≥ 18°C' })
const budget = a.criterionAdded({
  criterion: 'C3',
  on: 'D2',
  text: 'under 900',
})

const action = (overrides: Partial<ReturnType<typeof row>> = {}) =>
  row({
    text: 'A1: ',
    label: 'A1',
    description: 'Check school dates',
    ...overrides,
  })
const decision = (overrides: Partial<ReturnType<typeof row>> = {}) =>
  row({
    text: 'D1: ',
    label: 'D1',
    description: 'Which holiday do we book?',
    ...overrides,
  })
const criterion = (overrides: Partial<ReturnType<typeof row>> = {}) =>
  row({ text: 'C1: ', label: 'C1', description: 'Europe', ...overrides })

const action2 = () =>
  action({ text: 'A2: ', label: 'A2', description: 'Book the flights' })
const decision2 = () =>
  decision({ text: 'D2: ', label: 'D2', description: 'How do we get there?' })
const criterion2 = (overrides: Partial<ReturnType<typeof row>> = {}) =>
  criterion({
    text: 'C2: ',
    label: 'C2',
    description: 'sea ≥ 18°C',
    ...overrides,
  })
const criterion3 = () =>
  criterion({ text: 'C3: ', label: 'C3', description: 'under 900' })

describe('which actions, decisions and criteria are offered', () => {
  const cases: {
    name: string
    typed: ReturnType<typeof typing>
    rows: ReturnType<typeof row>[]
  }[] = [
    {
      name: 'A lists the actions, in ID order, not the thread',
      typed: typing({
        given: [a.goalOpened(), places, checkDates, bookFlights],
        text: 'A',
        token: 'A',
      }),
      rows: [action(), action2()],
    },
    {
      name: 'a lower case a lists the actions in upper case',
      typed: typing({
        given: [a.goalOpened(), checkDates, bookFlights],
        text: 'a',
        token: 'a',
      }),
      rows: [action(), action2()],
    },
    {
      name: 'a digit narrows the actions',
      typed: typing({
        given: [a.goalOpened(), checkDates, bookFlights],
        text: 'a2',
        cursor: 2,
        token: 'a2',
      }),
      rows: [action2()],
    },
    {
      name: 'a done and a cancelled action are still listed',
      typed: typing({
        given: [
          a.goalOpened(),
          checkDates,
          bookFlights,
          a.actionDone({ action: 'A1' }),
          a.actionCancelled({ action: 'A2' }),
        ],
        text: 'A',
        token: 'A',
      }),
      rows: [action(), action2()],
    },
    {
      name: 'd lists the decisions, never their options, and not the thread',
      typed: typing({
        given: [
          a.goalOpened(),
          places,
          holiday,
          a.optionAdded({ option: 'D1.1', decision: 'D1' }),
          a.optionAdded({ option: 'D1.2', decision: 'D1', title: 'Rhodes' }),
          transfer,
        ],
        text: 'd',
        token: 'd',
      }),
      rows: [decision(), decision2()],
    },
    {
      name: 'a decision decided twice, a decided one and a cancelled one are listed',
      typed: typing({
        given: [
          a.goalOpened(),
          holiday,
          a.optionAdded({ option: 'D1.1', decision: 'D1' }),
          a.optionAdded({ option: 'D1.2', decision: 'D1', title: 'Rhodes' }),
          a.decisionMade({ decision: 'D1', option: 'D1.1' }),
          a.decisionMade({ decision: 'D1', option: 'D1.2' }),
          transfer,
          a.nodeCancelled({ node: 'D2' }),
        ],
        text: 'D',
        token: 'D',
      }),
      rows: [decision(), decision2()],
    },
    {
      name: 'D1 narrows to that decision, not its options',
      typed: typing({
        given: [
          a.goalOpened(),
          holiday,
          a.optionAdded({ option: 'D1.1', decision: 'D1' }),
          transfer,
        ],
        text: 'D1',
        cursor: 2,
        token: 'D1',
      }),
      rows: [decision()],
    },
    {
      name: 'c lists the criteria',
      typed: typing({
        given: [a.goalOpened(), holiday, transfer, europe, sea, budget],
        text: 'c',
        token: 'c',
      }),
      rows: [criterion(), criterion2(), criterion3()],
    },
    {
      name: 'a revised criterion shows its new text',
      typed: typing({
        given: [
          a.goalOpened(),
          holiday,
          europe,
          sea,
          a.criterionRevised({ criterion: 'C2', text: 'sea ≥ 20°C' }),
        ],
        text: 'C',
        token: 'C',
      }),
      rows: [criterion(), criterion2({ description: 'sea ≥ 20°C' })],
    },
    {
      name: 'there are no decisions',
      typed: typing({
        given: [a.goalOpened(), places, checkDates],
        text: 'D',
        token: 'D',
      }),
      rows: [],
    },
    {
      name: 'there are no criteria',
      typed: typing({
        given: [a.goalOpened(), holiday],
        text: 'C',
        token: 'C',
      }),
      rows: [],
    },
  ]
  for (const { name, typed, rows } of cases) {
    test(`offers the right rows when ${name}`, () => {
      expect(rowsFor(typed)).toEqual(rows)
    })
  }
})

describe('actions, decisions and criteria the draft already names', () => {
  const given = [
    a.goalOpened(),
    holiday,
    a.optionAdded({ option: 'D1.1', decision: 'D1' }),
    transfer,
    checkDates,
    bookFlights,
    europe,
    sea,
  ]
  const cases: {
    name: string
    typed: ReturnType<typeof typing>
    rows: ReturnType<typeof row>[]
  }[] = [
    {
      name: 'an action on a line before the cursor',
      typed: typing({ given, text: 'A1: done\nA', cursor: 10, token: 'A' }),
      rows: [action2()],
    },
    {
      name: 'an action in lower case after the cursor',
      typed: typing({ given, text: 'A\na2: later', cursor: 1, token: 'A' }),
      rows: [action()],
    },
    {
      name: 'a decision by its own ID',
      typed: typing({ given, text: 'D1: yes\nD', cursor: 9, token: 'D' }),
      rows: [decision2()],
    },
    {
      name: 'an option, which does not hide its decision',
      typed: typing({ given, text: 'D1.1: yes\nD', cursor: 11, token: 'D' }),
      rows: [decision(), decision2()],
    },
    {
      name: 'a criterion in the middle of a line',
      typed: typing({
        given,
        text: 'but C2 is wrong\nC',
        cursor: 17,
        token: 'C',
      }),
      rows: [criterion()],
    },
  ]
  for (const { name, typed, rows } of cases) {
    test(`leaves out the named item when the draft names ${name}`, () => {
      expect(rowsFor(typed)).toEqual(rows)
    })
  }
})

test('offers nothing for an A that stands in the middle of a line', () => {
  expect(
    rowsFor(
      typing({
        given: [a.goalOpened(), checkDates],
        text: 'T1: take a',
        cursor: 10,
        token: 'a',
      }),
    ),
  ).toEqual([])
})

// zg-clv: an open thread that waits on the human (the latest reply is Claude's)
// is marked in the list, so the human answers what is waiting first.

const claudeAsks = (node: string, at = '2026-10-22T11:00:00.000Z') =>
  a.nodeReplied({ node, author: 'claude', text: 'OK?', at })
const humanAnswers = (node: string, at = '2026-10-22T12:00:00.000Z') =>
  a.nodeReplied({ node, author: 'human', text: 'Fine', at })

const waiting = (overrides: Partial<ReturnType<typeof row>> = {}) =>
  row({ description: 'waiting on you · Places in Greece', ...overrides })

describe('which rows are marked as waiting on you', () => {
  const cases: {
    name: string
    typed: ReturnType<typeof typing>
    rows: ReturnType<typeof row>[]
  }[] = [
    {
      name: 'Claude has the latest reply on a thread',
      typed: typing({ given: [a.goalOpened(), places, claudeAsks('T1')] }),
      rows: [waiting()],
    },
    {
      name: 'the human answered after Claude',
      typed: typing({
        given: [a.goalOpened(), places, claudeAsks('T1'), humanAnswers('T1')],
      }),
      rows: [row()],
    },
    {
      name: 'only one of two threads waits, in ID order',
      typed: typing({
        given: [a.goalOpened(), places, getting, claudeAsks('T2')],
      }),
      rows: [
        row(),
        row({
          text: 'T2: ',
          label: 'T2',
          description: 'waiting on you · Getting there',
        }),
      ],
    },
    {
      name: 'a decision has a reply from Claude',
      typed: typing({
        given: [a.goalOpened(), holiday, claudeAsks('D1')],
        text: 'D',
        token: 'D',
      }),
      rows: [decision()],
    },
    {
      name: 'an action has a reply from Claude',
      typed: typing({
        given: [a.goalOpened(), checkDates, claudeAsks('A1')],
        text: 'A',
        token: 'A',
      }),
      rows: [action()],
    },
    {
      name: 'a criterion has a reply from Claude',
      typed: typing({
        given: [a.goalOpened(), holiday, europe, claudeAsks('C1')],
        text: 'C',
        token: 'C',
      }),
      rows: [criterion()],
    },
  ]
  for (const { name, typed, rows } of cases) {
    test(`offers the right rows when ${name}`, () => {
      expect(rowsFor(typed)).toEqual(rows)
    })
  }
})
