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
    { text: 'Actions', isOpen: false },
    { text: '☐ A1 Check school dates (human)', isOpen: true },
    { text: '✓ A2 Book flights (claude)', isOpen: false },
    { text: '✗ A3 Rent a car (human) · taxis are fine', isOpen: false },
    { text: '→ A4 Pack (human) → handoff', isOpen: false },
  ])
})

test('the full view ends with the handoff once it is written', () => {
  const state = fold([a.goalOpened(), a.goalFailed(), a.handoffWritten()])

  expect(fullView(state)).toBe(
    [
      '✗ G Pick a holiday · failed: nowhere meets every criterion',
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
    { text: '○ G2 Plan the bars', isOpen: true },
    { text: 'Handoff out of date: write it again.', isOpen: false },
  ])
})
