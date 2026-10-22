import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import type { Command } from './commands.ts'
import { decide } from './decide.ts'
import type { Event } from './events.ts'
import { fold } from './evolve.ts'

// Given these events, when this command, then these events or a refusal.

const when = (given: Event[], command: Command) => decide(fold(given), command)

const goalAndAction = [a.goalOpened(), a.actionAdded()]
const finished = [
  a.goalOpened(),
  a.actionAdded(),
  a.actionDone(),
  a.goalAchieved(),
]

test('a new session opens its first goal as G', () => {
  expect(when([], a.openGoal())).toEqual({ events: [a.goalOpened()] })
})

test('a goal keeps its origin', () => {
  expect(when([], a.openGoal({ origin: 'zg-bam.2' }))).toEqual({
    events: [a.goalOpened({ origin: 'zg-bam.2' })],
  })
})

describe('one open goal', () => {
  test('refuses a second goal while the first is open', () => {
    expect(
      when([a.goalOpened()], a.openGoal({ text: 'Plan the bars' })),
    ).toEqual({
      refusal: {
        reason: 'One open goal: G is still open.',
        fix: 'Ask the human whether G is achieved, failed or cancelled, and close it first; or keep working on G.',
      },
    })
  })

  test('opens the next goal as G2 once the first is closed', () => {
    expect(
      when(
        [a.goalOpened(), a.goalCancelled()],
        a.openGoal({ text: 'Plan the bars' }),
      ),
    ).toEqual({
      events: [a.goalOpened({ goal: 'G2', text: 'Plan the bars' })],
    })
  })
})

describe('one parent', () => {
  test('an action is added under the open goal, numbered from A1', () => {
    expect(when([a.goalOpened()], a.addAction())).toEqual({
      events: [a.actionAdded()],
    })
  })

  test('an action keeps the words it came from', () => {
    expect(when([a.goalOpened()], a.addAction({ quote: 'remind me' }))).toEqual(
      {
        events: [a.actionAdded({ quote: 'remind me' })],
      },
    )
  })

  test('refuses an action when no goal is open', () => {
    expect(when([], a.addAction())).toEqual({
      refusal: {
        reason:
          'One parent: an action belongs to the open goal, and no goal is open.',
        fix: 'Open a goal first: the human starts one with /zg:open.',
      },
    })
  })
})

describe('an open action', () => {
  test('is done when the human says so', () => {
    expect(when(goalAndAction, a.completeAction())).toEqual({
      events: [a.actionDone()],
    })
  })

  test('is cancelled with the reason, when one was given', () => {
    expect(
      when(goalAndAction, a.cancelAction({ reason: 'school decides' })),
    ).toEqual({
      events: [a.actionCancelled({ reason: 'school decides' })],
    })
  })

  test('is cancelled without a reason, when none was given', () => {
    expect(when(goalAndAction, a.cancelAction())).toEqual({
      events: [a.actionCancelled()],
    })
  })

  test('is exported to the handoff for the human to file', () => {
    expect(when(goalAndAction, a.exportAction())).toEqual({
      events: [a.actionExported()],
    })
  })

  const refused: {
    name: string
    given: Event[]
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'refuses an action that does not exist',
      given: goalAndAction,
      command: a.completeAction({ action: 'A7' }),
      reason: 'There is no action A7.',
      fix: 'The open actions are A1.',
    },
    {
      name: 'refuses an action that is already closed',
      given: [...goalAndAction, a.actionDone()],
      command: a.cancelAction(),
      reason: 'A1 is already done.',
      fix: 'There are no open actions.',
    },
    {
      name: 'exports keep their reference: refuses an export without one',
      given: goalAndAction,
      command: a.exportAction({ ref: ' ' }),
      reason: 'Exports keep their reference: the export has none.',
      fix: 'Pass where A1 went (a bead ID, ticket key or path), or "handoff" to list it for the human to file.',
    },
  ]
  for (const { name, given, command, reason, fix } of refused) {
    test(name, () => {
      expect(when(given, command)).toEqual({ refusal: { reason, fix } })
    })
  }
})

describe('closing says how', () => {
  const closes: { name: string; command: Command; events: Event[] }[] = [
    {
      name: 'an achieved goal keeps the human’s words',
      command: a.closeGoal(),
      events: [a.goalAchieved()],
    },
    {
      name: 'a failed goal keeps why',
      command: a.failGoal(),
      events: [a.goalFailed()],
    },
    {
      name: 'a cancelled goal keeps its reason, when one was given',
      command: a.cancelGoal({ reason: 'too early' }),
      events: [a.goalCancelled({ reason: 'too early' })],
    },
  ]
  for (const { name, command, events } of closes) {
    test(name, () => {
      expect(when([a.goalOpened()], command)).toEqual({ events })
    })
  }

  const failedWithout = {
    refusal: {
      reason:
        "Closing says how: a failed goal needs the reason it can't be done.",
      fix: 'Ask the human why G failed, and pass it as the reason.',
    },
  }

  test('refuses a failed goal without a reason', () => {
    expect(when([a.goalOpened()], a.failGoal({ reason: undefined }))).toEqual(
      failedWithout,
    )
  })

  test('refuses a failed goal with a blank reason', () => {
    expect(when([a.goalOpened()], a.failGoal({ reason: ' ' }))).toEqual(
      failedWithout,
    )
  })

  test('refuses closing a goal when none is open', () => {
    expect(when(finished, a.closeGoal())).toEqual({
      refusal: {
        reason: 'No goal is open.',
        fix: 'Nothing to close: write the handoff, or the human opens a goal with /zg:open.',
      },
    })
  })
})

describe('close only when nothing is open', () => {
  test('the handoff is written once the goal and every action are closed', () => {
    const decisions = [{ text: 'Paphos', lasting: true }]

    expect(when(finished, a.writeHandoff({ decisions }))).toEqual({
      events: [a.handoffWritten({ decisions })],
    })
  })

  test('the handoff is written after a cancelled goal and action', () => {
    expect(
      when(
        [...goalAndAction, a.actionCancelled(), a.goalCancelled()],
        a.writeHandoff(),
      ),
    ).toEqual({ events: [a.handoffWritten()] })
  })

  test('a handoff can be written again, replacing the last', () => {
    expect(
      when(
        [...finished, a.handoffWritten()],
        a.writeHandoff({ next: 'Book a hotel' }),
      ),
    ).toEqual({ events: [a.handoffWritten({ next: 'Book a hotel' })] })
  })

  test('refuses the handoff while the goal or an action is open', () => {
    expect(when(goalAndAction, a.writeHandoff())).toEqual({
      refusal: {
        reason: 'Close only when nothing is open: G, A1 still open.',
        fix: 'Ask the human how each one ends: the goal achieved, failed or cancelled; each action done, cancelled, or exported to the handoff for filing.',
      },
    })
  })

  test('a /clear closes the session once its handoff stands', () => {
    expect(when([...finished, a.handoffWritten()], a.closeSession())).toEqual({
      events: [a.sessionClosed()],
    })
  })

  const unclosed: { name: string; given: Event[] }[] = [
    { name: 'before any handoff', given: finished },
    {
      name: 'after work resumed past the handoff',
      given: [...finished, a.handoffWritten(), a.goalOpened({ goal: 'G2' })],
    },
  ]
  for (const { name, given } of unclosed) {
    test(`refuses closing the session ${name}`, () => {
      expect(when(given, a.closeSession())).toEqual({
        refusal: {
          reason:
            'Close only when nothing is open: the session closes after its handoff is written, and none stands.',
          fix: 'Run /zg:close in the session to close the goal and write the handoff.',
        },
      })
    })
  }
})

describe('a closed session', () => {
  const closed = [...finished, a.handoffWritten(), a.sessionClosed()]
  const commands: { name: string; command: Command }[] = [
    { name: 'a new goal', command: a.openGoal() },
    { name: 'a new action', command: a.addAction() },
    { name: 'a new handoff', command: a.writeHandoff() },
  ]
  for (const { name, command } of commands) {
    test(`refuses ${name}`, () => {
      expect(when(closed, command)).toEqual({
        refusal: {
          reason:
            'This session is closed: its handoff was written and it was cleared.',
          fix: 'Start a new session, and open its goal with /zg:open.',
        },
      })
    })
  }
})
