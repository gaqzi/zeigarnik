import { expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { fold } from './evolve.ts'
import { handoff } from './handoff.ts'

const finished = [a.goalOpened(), a.goalAchieved()]

test('no handoff is written yet', () => {
  expect(handoff(fold(finished))).toBe('')
})

test('a handoff with only the next goal is one line', () => {
  expect(handoff(fold([...finished, a.handoffWritten()]))).toBe(
    'Goal: Book the flights',
  )
})

test('lists decisions and references, and what to file by hand', () => {
  const state = fold([
    a.goalOpened(),
    a.actionAdded({ text: 'Book flights' }),
    a.actionExported(),
    a.actionAdded({ action: 'A2', text: 'Ask about pets' }),
    a.actionExported({ action: 'A2', ref: 'zg-x1y' }),
    a.goalAchieved(),
    a.handoffWritten({
      next: 'Choose where to stay in Paphos',
      decisions: [
        { text: 'Paphos', lasting: true },
        { text: 'Skip the bars list', lasting: false },
      ],
      references: ['notes/holiday-2027.md'],
    }),
  ])

  expect(handoff(state)).toBe(
    [
      'Goal: Choose where to stay in Paphos',
      'Decisions to respect:',
      '  - Paphos',
      '  - Skip the bars list',
      'References:',
      '  - notes/holiday-2027.md',
      'To file by hand:',
      '  - Action: Book flights',
      '  - Decision: Paphos',
    ].join('\n'),
  )
})
