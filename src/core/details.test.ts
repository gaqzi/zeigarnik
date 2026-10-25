import { expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { details } from './details.ts'
import { fold } from './evolve.ts'

// What zg knows about one item: its block of lines, each dim once the item is
// closed, like its row in the pane.
const block = (isOpen: boolean, ...texts: string[]) =>
  texts.map(text => ({ text, isOpen }))

const bus = fold([
  a.goalOpened(),
  a.threadOpened({ thread: 'T2', title: 'Places in Spain' }),
  a.threadOpened({ thread: 'T5', parent: 'T2', title: '2h bus?' }),
  a.threadOpened({ thread: 'T8', parent: 'T5', title: 'Which village?' }),
  a.threadResolved({ thread: 'T8', outcome: 'village is out' }),
  a.nodeReplied({
    node: 'T5',
    author: 'claude',
    text: 'The bus takes two hours each way',
  }),
  a.nodeReplied({ node: 'T5', text: 'no, two hours with the kids is a no' }),
])

test('a thread’s details are its title, where it sits, how it stands, its children and its replies', () => {
  expect(details(bus, 'T5')).toEqual(
    block(
      true,
      'T5 2h bus?',
      'under T2',
      'open',
      'children: T8 ✓ village is out',
      '#1 claude: The bus takes two hours each way',
      '#2 human: no, two hours with the kids is a no',
    ),
  )
})

const spain = fold([
  a.goalOpened(),
  a.threadOpened({ thread: 'T4', title: 'Spain trip' }),
  a.threadOpened({ thread: 'T5', title: 'Places in Spain' }),
  a.nodeReplied({ node: 'T4', text: 'same trip' }),
  a.nodeReplied({ node: 'T5', author: 'claude', text: 'Noted' }),
  a.nodeMerged({
    from: ['T4'],
    into: 'T5',
    reason: 'T4–T7 are the same as T5',
  }),
])

test('a merged thread’s details say where it went and why, verbatim, with only its own replies, dimmed', () => {
  expect(details(spain, 'T4')).toEqual(
    block(
      false,
      'T4 Spain trip',
      'under G',
      'merged → T5',
      'T4–T7 are the same as T5',
      '#1 human: same trip',
    ),
  )
})

test('the thread merged into lists what was merged into it', () => {
  const state = fold([
    a.goalOpened(),
    a.threadOpened({ thread: 'T4', title: 'Spain trip' }),
    a.threadOpened({ thread: 'T5', title: 'Places in Spain' }),
    a.threadOpened({ thread: 'T6', title: 'Spain, again' }),
    a.nodeMerged(),
  ])

  expect(details(state, 'T5')).toEqual(
    block(true, 'T5 Places in Spain', 'under G', 'open', 'merged from T4, T6'),
  )
})

test('an exported action’s details are its text, owner, where it went and why, dimmed', () => {
  const state = fold([
    a.goalOpened(),
    a.actionAdded(),
    a.actionExported({ reason: 'do this after' }),
  ])

  expect(details(state, 'A1')).toEqual(
    block(
      false,
      'A1 Check school dates',
      'owner: human',
      'exported → handoff',
      'do this after',
    ),
  )
})

test('an ID that names no thread or action has no details', () => {
  expect(details(bus, 'T99')).toEqual([])
})
