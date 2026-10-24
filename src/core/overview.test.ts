import { expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { fold } from './evolve.ts'
import { fullView, overview } from './overview.ts'

test('a session without a goal says so', () => {
  expect(overview(fold([]))).toEqual([{ text: 'No goal yet.', isOpen: false }])
})

test('shows each goal and action with how it stands', () => {
  const state = fold([
    a.goalOpened({ origin: 'zg-bam.2' }),
    a.actionAdded(),
    a.actionAdded({ action: 'A2', text: 'Book flights', owner: 'claude' }),
    a.actionAdded({ action: 'A3', text: 'Rent a car' }),
    a.actionAdded({ action: 'A4', text: 'Pack' }),
    a.actionDone({ action: 'A2' }),
    a.actionCancelled({ action: 'A3', reason: 'taxis are fine' }),
    a.actionExported({ action: 'A4' }),
  ])

  expect(overview(state)).toEqual([
    { text: '○ G Pick a holiday (zg-bam.2)', isOpen: true },
    { text: '0 open · 0 closed', isOpen: true },
    { text: 'Actions', isOpen: false },
    { text: '☐ A1 Check school dates (human)', isOpen: true },
    { text: '✓ A2 Book flights (claude)', isOpen: false },
    { text: '✗ A3 Rent a car (human) · taxis are fine', isOpen: false },
    { text: '→ A4 Pack (human) → handoff', isOpen: false },
  ])
})

test('shows the threads as a tree under the goal, with how many are open', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened(),
    a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Rhodes' }),
    a.threadOpened({ thread: 'T3', title: 'Flights' }),
  ])

  expect(overview(state)).toEqual([
    { text: '○ G Pick a holiday', isOpen: true },
    { text: '3 open · 0 closed', isOpen: true },
    { text: '  ✦ T1 Places in Greece', isOpen: true },
    { text: '    ✦ T2 Rhodes', isOpen: true },
    { text: '  ✦ T3 Flights', isOpen: true },
  ])
})

test('shows closed threads dimmed at their depth, with the outcome or the reason, and counts them', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened(),
    a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Rhodes' }),
    a.threadOpened({ thread: 'T3', title: 'Flights' }),
    a.threadResolved({ thread: 'T2', outcome: 'Rhodes and Crete' }),
    a.nodeCancelled({ node: 'T3', reason: 'not going to Greece' }),
  ])

  expect(overview(state)).toEqual([
    { text: '○ G Pick a holiday', isOpen: true },
    { text: '1 open · 2 closed', isOpen: true },
    { text: '  ✦ T1 Places in Greece', isOpen: true },
    { text: '    ✓ T2 Rhodes → Rhodes and Crete', isOpen: false },
    { text: '  ✗ T3 Flights · not going to Greece', isOpen: false },
  ])
})

test('shows the reason after any outcome that has one', () => {
  const state = fold([
    a.goalOpened(),
    a.actionAdded({ action: 'A2', text: 'Book flights', owner: 'claude' }),
    a.actionAdded({ action: 'A4', text: 'Pack' }),
    a.actionDone({ action: 'A2', reason: 'shipped' }),
    a.actionExported({ action: 'A4', reason: 'for the next trip' }),
    a.goalAchieved({ reason: 'good enough' }),
  ])

  expect(overview(state)).toEqual([
    { text: '✓ G Pick a holiday · achieved: good enough', isOpen: false },
    { text: '0 open · 0 closed', isOpen: false },
    { text: 'Actions', isOpen: false },
    { text: '✓ A2 Book flights (claude) · shipped', isOpen: false },
    {
      text: '→ A4 Pack (human) → handoff · for the next trip',
      isOpen: false,
    },
  ])
})

test('the full view ends with the handoff once it is written', () => {
  const state = fold([a.goalOpened(), a.goalFailed(), a.handoffWritten()])

  expect(fullView(state)).toBe(
    [
      '✗ G Pick a holiday · failed: nowhere meets every criterion',
      '0 open · 0 closed',
      'Handoff written: /zg:copy-handoff copies it.',
      '',
      'Goal: Book the flights',
    ].join('\n'),
  )
})

test('a handoff is out of date once work goes on past it', () => {
  const state = fold([
    a.goalOpened(),
    a.goalAchieved(),
    a.handoffWritten(),
    a.goalOpened({ goal: 'G2', text: 'Plan the bars' }),
  ])

  expect(overview(state)).toEqual([
    { text: '✓ G Pick a holiday · achieved', isOpen: false },
    { text: '0 open · 0 closed', isOpen: false },
    { text: '○ G2 Plan the bars', isOpen: true },
    { text: '0 open · 0 closed', isOpen: true },
    { text: 'Handoff out of date: write it again.', isOpen: false },
  ])
})

const talk = [
  a.goalOpened(),
  a.threadOpened({ thread: 'T5', title: '2h bus?' }),
  a.threadOpened({ thread: 'T6', parent: 'T5', title: 'Transfers' }),
  a.threadOpened({ thread: 'T7', title: 'Flights' }),
  a.nodeReplied({ node: 'T5' }),
  a.nodeReplied({ node: 'T7', text: 'only direct' }),
  a.nodeReplied({
    node: 'T5',
    author: 'claude',
    text: 'Noted: transfers under 30 minutes',
  }),
]

test('the full view lists a thread’s replies under it, before its children, numbered per thread in log order', () => {
  expect(fullView(fold(talk))).toBe(
    [
      '○ G Pick a holiday',
      '3 open · 0 closed',
      '  ○ T5 2h bus?',
      '    #1 human: no, two hours with the kids is a no',
      '    #2 claude: Noted: transfers under 30 minutes',
      '    ○ T6 Transfers',
      '  ○ T7 Flights',
      '    #1 human: only direct',
    ].join('\n'),
  )
})

test('a reply with several lines keeps every later line under its own text, so it cannot pass for a reply or a node', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
    a.nodeReplied({ node: 'T5', text: 'fine\n    #2 claude: agreed' }),
  ])

  expect(fullView(state)).toBe(
    [
      '○ G Pick a holiday',
      '1 open · 0 closed',
      '  ○ T5 2h bus?',
      '    #1 human: fine',
      '                  #2 claude: agreed',
    ].join('\n'),
  )
})

test('the pane’s overview leaves replies out', () => {
  expect(overview(fold(talk)).map(line => line.text)).toEqual([
    '○ G Pick a holiday',
    '3 open · 0 closed',
    '  ○ T5 2h bus?',
    '    ✦ T6 Transfers',
    '  ○ T7 Flights',
  ])
})
