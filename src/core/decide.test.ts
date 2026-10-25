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

  const underGoal = [a.goalOpened(), a.threadOpened()]

  test('a thread opens under the open goal as T1', () => {
    expect(when([a.goalOpened()], a.openThread())).toEqual({
      events: [a.threadOpened()],
    })
  })

  test('a thread opens under an open thread', () => {
    expect(
      when(underGoal, a.openThread({ parent: 'T1', title: 'Rhodes' })),
    ).toEqual({
      events: [a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Rhodes' })],
    })
  })

  test('threads are numbered across the session, whatever their depth', () => {
    const given = [
      ...underGoal,
      a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Rhodes' }),
      a.threadOpened({ thread: 'T3', title: 'Flights' }),
    ]

    expect(
      when(given, a.openThread({ parent: 'T2', title: 'Ferries' })),
    ).toEqual({
      events: [
        a.threadOpened({ thread: 'T4', parent: 'T2', title: 'Ferries' }),
      ],
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
      name: 'refuses a thread when no goal is open',
      given: [],
      command: a.openThread(),
      reason:
        "One parent: a thread belongs to the open goal's tree, and no goal is open.",
      fix: 'Open a goal first: the human starts one with /zg:open.',
    },
    {
      name: 'refuses a parent that does not exist',
      given: underGoal,
      command: a.openThread({ parent: 'T7' }),
      reason: 'One parent: there is no thread T7.',
      fix: 'The open threads are T1.',
    },
    {
      name: 'refuses a parent that does not exist when no thread is open',
      given: [a.goalOpened()],
      command: a.openThread({ parent: 'T7' }),
      reason: 'One parent: there is no thread T7.',
      fix: 'There are no open threads.',
    },
    {
      name: 'refuses a resolved parent',
      given: [...underGoal, a.threadResolved()],
      command: a.openThread({ parent: 'T1' }),
      reason: 'One parent: T1 is already resolved.',
      fix: "Open it under T1's parent G, or under another open thread.",
    },
    {
      name: 'refuses a cancelled parent',
      given: [...underGoal, a.nodeCancelled()],
      command: a.openThread({ parent: 'T1' }),
      reason: 'One parent: T1 is already cancelled.',
      fix: "Open it under T1's parent G, or under another open thread.",
    },
  ]
  for (const { name, given, command, reason, fix } of refused) {
    test(name, () => {
      expect(when(given, command)).toEqual({ refusal: { reason, fix } })
    })
  }

  const twoOpen = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T2' }),
    a.threadOpened({ thread: 'T5' }),
  ]

  test('an open thread nests under another open thread', () => {
    expect(when(twoOpen, a.nestNode())).toEqual({ events: [a.nodeMoved()] })
  })

  test('the goal is a valid parent: a thread moves up to it', () => {
    const given = [...twoOpen, a.nodeMoved()]

    expect(when(given, a.nestNode({ parent: 'G' }))).toEqual({
      events: [a.nodeMoved({ parent: 'G' })],
    })
  })

  test('a move records its source', () => {
    expect(when(twoOpen, a.nestNode({ source: 'claude' }))).toEqual({
      events: [a.nodeMoved({ source: 'claude' })],
    })
  })

  const tree = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T1' }),
    a.threadOpened({ thread: 'T2', parent: 'T1' }),
    a.threadOpened({ thread: 'T3' }),
    a.threadResolved({ thread: 'T3' }),
  ]
  const underSecondGoal = [
    a.goalOpened(),
    a.goalAchieved(),
    a.goalOpened({ goal: 'G2' }),
    a.threadOpened({ thread: 'T1', parent: 'G2' }),
    a.threadOpened({ thread: 'T2', parent: 'T1' }),
    a.threadOpened({ thread: 'T3', parent: 'G2' }),
  ]
  const leaveT1 = 'Leave T1 where it is: no other open parent can take it.'
  const nestRefused: {
    name: string
    given: Event[]
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'refuses a thread under its own descendant',
      given: tree,
      command: a.nestNode({ node: 'T1', parent: 'T2' }),
      reason:
        "One parent: T2 is under T1; a thread can't nest under its own descendant.",
      fix: leaveT1,
    },
    {
      name: 'refuses a thread under its own descendant at any depth',
      given: [...tree, a.threadOpened({ thread: 'T4', parent: 'T2' })],
      command: a.nestNode({ node: 'T1', parent: 'T4' }),
      reason:
        "One parent: T4 is under T1; a thread can't nest under its own descendant.",
      fix: leaveT1,
    },
    {
      name: 'refuses a thread as its own parent',
      given: tree,
      command: a.nestNode({ node: 'T1', parent: 'T1' }),
      reason: "One parent: a thread can't be its own parent.",
      fix: leaveT1,
    },
    {
      name: 'refuses a resolved parent',
      given: tree,
      command: a.nestNode({ node: 'T2', parent: 'T3' }),
      reason: 'One parent: T3 is already resolved.',
      fix: 'Nest T2 under G.',
    },
    {
      name: 'refuses to move a resolved thread',
      given: tree,
      command: a.nestNode({ node: 'T3', parent: 'T1' }),
      reason:
        'One parent: T3 is already resolved; a closed thread stays where it rolled up.',
      fix: 'Leave T3 where it is; if it comes up again, open a new thread.',
    },
    {
      name: 'refuses a parent that does not exist',
      given: tree,
      command: a.nestNode({ node: 'T2', parent: 'T9' }),
      reason: 'One parent: there is no thread T9.',
      fix: 'Nest T2 under G.',
    },
    {
      name: 'names every parent that would take the thread, goal first',
      given: [
        ...tree,
        a.threadOpened({ thread: 'T4' }),
        a.threadOpened({ thread: 'T5' }),
      ],
      command: a.nestNode({ node: 'T2', parent: 'T9' }),
      reason: 'One parent: there is no thread T9.',
      fix: 'Nest T2 under G, T4 or T5.',
    },
    {
      name: 'refuses a thread that does not exist',
      given: tree,
      command: a.nestNode({ node: 'T9', parent: 'T1' }),
      reason: 'One parent: there is no thread T9.',
      fix: 'The open threads are T1, T2.',
    },
    {
      name: 'refuses the parent the thread is already under',
      given: tree,
      command: a.nestNode({ node: 'T2', parent: 'T1' }),
      reason: 'One parent: T2 is already under T1.',
      fix: 'Nest T2 under G.',
    },
    {
      name: 'refuses a move when no goal is open',
      given: [
        a.goalOpened(),
        a.threadOpened({ thread: 'T1' }),
        a.threadOpened({ thread: 'T2' }),
        a.goalAchieved(),
      ],
      command: a.nestNode({ node: 'T2', parent: 'T1' }),
      reason:
        "One parent: a thread belongs to the open goal's tree, and no goal is open.",
      fix: 'Open a goal first: the human starts one with /zg:open.',
    },
    {
      name: 'names the open goal by its ID',
      given: underSecondGoal,
      command: a.nestNode({ node: 'T2', parent: 'T9' }),
      reason: 'One parent: there is no thread T9.',
      fix: 'Nest T2 under G2 or T3.',
    },
    {
      name: 'leaves out the goal a thread is already under',
      given: underSecondGoal,
      command: a.nestNode({ node: 'T1', parent: 'T9' }),
      reason: 'One parent: there is no thread T9.',
      fix: 'Nest T1 under T3.',
    },
  ]
  for (const { name, given, command, reason, fix } of nestRefused) {
    test(name, () => {
      expect(when(given, command)).toEqual({ refusal: { reason, fix } })
    })
  }

  test('a parent cycle elsewhere in the log does not hang the descendant check', () => {
    const given = [
      a.goalOpened(),
      a.threadOpened({ thread: 'T1' }),
      a.threadOpened({ thread: 'T3', parent: 'T4' }),
      a.threadOpened({ thread: 'T4', parent: 'T3' }),
    ]

    expect(when(given, a.nestNode({ node: 'T1', parent: 'T3' }))).toEqual({
      events: [a.nodeMoved({ node: 'T1', parent: 'T3' })],
    })
  })

  const threeOpen = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T4' }),
    a.threadOpened({ thread: 'T5' }),
    a.threadOpened({ thread: 'T6' }),
  ]

  test('open threads merge into another open thread, the event keeping the order they were named in', () => {
    expect(when(threeOpen, a.mergeNodes({ from: ['T6', 'T4'] }))).toEqual({
      events: [a.nodeMerged({ from: ['T6', 'T4'] })],
    })
  })

  test('a merge records its source and the words that folded the threads', () => {
    expect(
      when(
        threeOpen,
        a.mergeNodes({ source: 'claude', reason: 'same question twice' }),
      ),
    ).toEqual({
      events: [
        a.nodeMerged({ source: 'claude', reason: 'same question twice' }),
      ],
    })
  })

  const folding = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T1' }),
    a.threadOpened({ thread: 'T2', parent: 'T1' }),
    a.threadOpened({ thread: 'T3' }),
    a.threadResolved({ thread: 'T3' }),
  ]
  const mergeRefused: {
    name: string
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'refuses to merge a thread into its own descendant',
      command: a.mergeNodes({ from: ['T1'], into: 'T2' }),
      reason:
        "One parent: T2 is under T1; T2 can't take its own ancestor's children.",
      fix: 'Merge T1 into a thread outside its own branch, or leave it where it is.',
    },
    {
      name: 'refuses to merge a resolved thread',
      command: a.mergeNodes({ from: ['T3'], into: 'T1' }),
      reason:
        'T3 is already resolved; a closed thread stays where it rolled up.',
      fix: 'Leave T3 where it is; if it comes up again, open a new thread.',
    },
    {
      name: 'refuses to merge into a resolved thread',
      command: a.mergeNodes({ from: ['T1'], into: 'T3' }),
      reason: 'T3 is already resolved.',
      fix: 'Merge T1 into another open thread, or leave it where it is.',
    },
    {
      name: 'refuses to merge a thread into itself',
      command: a.mergeNodes({ from: ['T1'], into: 'T1' }),
      reason: "One parent: a thread can't merge into itself.",
      fix: 'Merge T1 into another open thread, or leave it where it is.',
    },
    {
      name: 'refuses to merge several threads into a resolved thread',
      command: a.mergeNodes({ from: ['T1', 'T2'], into: 'T3' }),
      reason: 'T3 is already resolved.',
      fix: 'Merge T1 and T2 into another open thread, or leave them where they are.',
    },
    {
      name: 'refuses to merge the goal',
      command: a.mergeNodes({ from: ['G'], into: 'T1' }),
      reason: 'There is no thread G.',
      fix: 'The open threads are T1, T2.',
    },
    {
      name: 'refuses to merge into the goal',
      command: a.mergeNodes({ from: ['T1'], into: 'G' }),
      reason: 'There is no thread G.',
      fix: 'The open threads are T1, T2.',
    },
    {
      name: 'refuses a thread to fold in that does not exist',
      command: a.mergeNodes({ from: ['T1', 'T9'], into: 'T2' }),
      reason: 'There is no thread T9.',
      fix: 'The open threads are T1, T2.',
    },
  ]
  for (const { name, command, reason, fix } of mergeRefused) {
    test(name, () => {
      expect(when(folding, command)).toEqual({ refusal: { reason, fix } })
    })
  }
})

describe('a merged thread stays merged', () => {
  const given = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T4' }),
    a.threadOpened({ thread: 'T5' }),
    a.threadOpened({ thread: 'T6' }),
    a.nodeMerged({ from: ['T4'], into: 'T5' }),
  ]
  const fix = 'T4 was merged into T5; work on T5 instead.'
  const refused: { name: string; command: Command }[] = [
    {
      name: 'refuses to merge it again',
      command: a.mergeNodes({ from: ['T4'], into: 'T6' }),
    },
    {
      name: 'refuses to merge a thread into it',
      command: a.mergeNodes({ from: ['T6'], into: 'T4' }),
    },
    {
      name: 'refuses to nest it',
      command: a.nestNode({ node: 'T4', parent: 'T6' }),
    },
    {
      name: 'refuses to nest a thread under it',
      command: a.nestNode({ node: 'T6', parent: 'T4' }),
    },
    {
      name: 'refuses to open a thread under it',
      command: a.openThread({ parent: 'T4' }),
    },
    {
      name: 'refuses a reply to it',
      command: a.replyToNode({ node: 'T4' }),
    },
    {
      name: 'refuses to resolve it',
      command: a.resolveThread({ thread: 'T4' }),
    },
    {
      name: 'refuses to cancel it',
      command: a.cancelNode({ node: 'T4' }),
    },
  ]
  for (const { name, command } of refused) {
    test(name, () => {
      expect(when(given, command)).toEqual({
        refusal: { reason: 'T4 is already merged.', fix },
      })
    })
  }
})

describe('an open action', () => {
  const ends: { name: string; command: Command; events: Event[] }[] = [
    {
      name: 'is done from a dialog pick, with no words',
      command: a.completeAction({ source: 'dialog' }),
      events: [a.actionDone({ source: 'dialog' })],
    },
    {
      name: 'is done in chat, with the human’s words as the reason',
      command: a.completeAction({ reason: 'shipped' }),
      events: [a.actionDone({ reason: 'shipped' })],
    },
    {
      name: 'is cancelled from a dialog note, which is the reason',
      command: a.cancelAction({ source: 'dialog', reason: 'moot' }),
      events: [a.actionCancelled({ source: 'dialog', reason: 'moot' })],
    },
    {
      name: 'is cancelled without a reason, when none was given',
      command: a.cancelAction(),
      events: [a.actionCancelled()],
    },
    {
      name: 'is exported to the handoff from a dialog pick',
      command: a.exportAction({ source: 'dialog' }),
      events: [a.actionExported({ source: 'dialog' })],
    },
  ]
  for (const { name, command, events } of ends) {
    test(name, () => {
      expect(when(goalAndAction, command)).toEqual({ events })
    })
  }

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
      name: 'an achieved goal records a dialog pick, with no words',
      command: a.closeGoal({ source: 'dialog' }),
      events: [a.goalAchieved({ source: 'dialog' })],
    },
    {
      name: 'an achieved goal keeps a dialog note as the reason',
      command: a.closeGoal({ source: 'dialog', reason: 'good enough' }),
      events: [a.goalAchieved({ source: 'dialog', reason: 'good enough' })],
    },
    {
      name: 'a failed goal keeps why',
      command: a.failGoal({ reason: 'no venue fits' }),
      events: [a.goalFailed({ reason: 'no venue fits' })],
    },
    {
      name: 'a cancelled goal keeps the words typed in chat',
      command: a.cancelGoal({ reason: 'Cancel it' }),
      events: [a.goalCancelled({ reason: 'Cancel it' })],
    },
    {
      name: 'a cancelled goal has no reason when none was given',
      command: a.cancelGoal(),
      events: [a.goalCancelled()],
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

  test('refuses a failed goal picked in a dialog without the human’s words', () => {
    expect(
      when(
        [a.goalOpened()],
        a.failGoal({ source: 'dialog', reason: undefined }),
      ),
    ).toEqual(failedWithout)
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

  const threadOpen = [a.goalOpened(), a.threadOpened()]

  test('a thread resolves with its outcome', () => {
    expect(when(threadOpen, a.resolveThread())).toEqual({
      events: [a.threadResolved()],
    })
  })

  test('a thread resolves on Claude’s own word', () => {
    expect(when(threadOpen, a.resolveThread({ source: 'claude' }))).toEqual({
      events: [a.threadResolved({ source: 'claude' })],
    })
  })

  test('a thread is cancelled with the words that closed it', () => {
    expect(when(threadOpen, a.cancelNode())).toEqual({
      events: [a.nodeCancelled()],
    })
  })

  test('a thread is cancelled on Claude’s own word', () => {
    expect(when(threadOpen, a.cancelNode({ source: 'claude' }))).toEqual({
      events: [a.nodeCancelled({ source: 'claude' })],
    })
  })

  const withoutOutcome: { name: string; outcome: string | undefined }[] = [
    { name: 'no outcome', outcome: undefined },
    { name: 'a blank outcome', outcome: '   ' },
  ]
  for (const { name, outcome } of withoutOutcome) {
    test(`refuses a resolved thread with ${name}`, () => {
      expect(when(threadOpen, a.resolveThread({ outcome }))).toEqual({
        refusal: {
          reason: 'Closing says how: a resolved thread needs its outcome.',
          fix: 'Pass what T1 settled as the outcome: a short summary, your words are fine.',
        },
      })
    })
  }
})

describe('a thread closes once', () => {
  const closing: {
    name: string
    status: string
    closed: Event
    command: Command
  }[] = [
    {
      name: 'refuses resolving a resolved thread',
      status: 'resolved',
      closed: a.threadResolved(),
      command: a.resolveThread(),
    },
    {
      name: 'refuses cancelling a resolved thread',
      status: 'resolved',
      closed: a.threadResolved(),
      command: a.cancelNode(),
    },
    {
      name: 'refuses resolving a cancelled thread',
      status: 'cancelled',
      closed: a.nodeCancelled(),
      command: a.resolveThread(),
    },
  ]
  for (const { name, status, closed, command } of closing) {
    test(name, () => {
      const given = [
        a.goalOpened(),
        a.threadOpened(),
        a.threadOpened({ thread: 'T2', title: 'Flights' }),
        closed,
      ]

      expect(when(given, command)).toEqual({
        refusal: {
          reason: `T1 is already ${status}.`,
          fix: 'The open threads are T2.',
        },
      })
    })
  }

  const unknown: { name: string; command: Command }[] = [
    { name: 'resolving', command: a.resolveThread({ thread: 'T7' }) },
    { name: 'cancelling', command: a.cancelNode({ node: 'T7' }) },
  ]
  for (const { name, command } of unknown) {
    test(`refuses ${name} a thread that does not exist`, () => {
      const given = [
        a.goalOpened(),
        a.threadOpened(),
        a.threadOpened({ thread: 'T2', title: 'Flights' }),
        a.threadResolved(),
      ]

      expect(when(given, command)).toEqual({
        refusal: {
          reason: 'There is no thread T7.',
          fix: 'The open threads are T2.',
        },
      })
    })
  }

  test('says so when no thread is open to close instead', () => {
    expect(when([a.goalOpened()], a.resolveThread({ thread: 'T7' }))).toEqual({
      refusal: {
        reason: 'There is no thread T7.',
        fix: 'There are no open threads.',
      },
    })
  })
})

describe('a closed thread takes no replies', () => {
  const closed: { name: string; status: string; closed: Event }[] = [
    {
      name: 'refuses a reply to a resolved thread',
      status: 'resolved',
      closed: a.threadResolved({ thread: 'T5' }),
    },
    {
      name: 'refuses a reply to a cancelled thread',
      status: 'cancelled',
      closed: a.nodeCancelled({ node: 'T5' }),
    },
  ]
  for (const { name, status, closed: end } of closed) {
    test(name, () => {
      const given = [
        a.goalOpened(),
        a.threadOpened({ thread: 'T5', title: '2h bus?' }),
        a.threadOpened({ thread: 'T6', title: 'Flights' }),
        end,
      ]

      expect(when(given, a.replyToNode({ node: 'T5' }))).toEqual({
        refusal: {
          reason: `T5 is already ${status}.`,
          fix: "Open a new thread under T5's parent for what's new; the open threads are T6.",
        },
      })
    })
  }

  test('says there are no open threads when none is left to name', () => {
    const given = [
      a.goalOpened(),
      a.threadOpened({ thread: 'T5', title: '2h bus?' }),
      a.threadResolved({ thread: 'T5' }),
    ]

    expect(when(given, a.replyToNode({ node: 'T5' }))).toEqual({
      refusal: {
        reason: 'T5 is already resolved.',
        fix: "Open a new thread under T5's parent for what's new; there are no open threads.",
      },
    })
  })

  test('refuses a reply to a thread that does not exist', () => {
    const given = [a.goalOpened(), a.threadOpened({ thread: 'T5' })]

    expect(when(given, a.replyToNode({ node: 'T9' }))).toEqual({
      refusal: {
        reason: 'There is no thread T9.',
        fix: 'The open threads are T5.',
      },
    })
  })
})

describe('replies are kept verbatim', () => {
  test('a reply to an open thread appends one NodeReplied with its author and text', () => {
    const given = [a.goalOpened(), a.threadOpened({ thread: 'T5' })]
    const text = '  Noted:  transfers\nunder 30 minutes  '

    expect(
      when(given, a.replyToNode({ node: 'T5', author: 'claude', text })),
    ).toEqual({
      events: [a.nodeReplied({ node: 'T5', author: 'claude', text })],
    })
  })
})

describe('children close first', () => {
  const threadFix =
    'Show the human the open children and ask how each ends, or propose one outcome that settles them for the human to confirm.'
  const goalFix =
    'Ask the human how each ends, or, if their words end the whole session, cancel every open item with those words, children first, then the goal.'
  const under = (thread: string, title: string) =>
    a.threadOpened({ thread, parent: 'T1', title })

  test('a parent closes once every child has', () => {
    const given = [
      a.goalOpened(),
      a.threadOpened(),
      under('T2', 'Places in Greece'),
      under('T3', 'Places in Spain'),
      a.threadResolved({ thread: 'T2' }),
      a.nodeCancelled({ node: 'T3' }),
    ]

    expect(when(given, a.resolveThread())).toEqual({
      events: [a.threadResolved()],
    })
  })

  const mergedChild = [
    a.goalOpened(),
    a.threadOpened(),
    under('T2', 'Places in Spain'),
    a.threadOpened({ thread: 'T3', title: 'Spain trip' }),
    a.nodeMerged({ from: ['T2'], into: 'T3' }),
  ]

  test('a parent closes when its only child was merged away', () => {
    expect(when(mergedChild, a.resolveThread())).toEqual({
      events: [a.threadResolved()],
    })
  })

  test('a parent is cancelled when its only child was merged away', () => {
    expect(when(mergedChild, a.cancelNode())).toEqual({
      events: [a.nodeCancelled()],
    })
  })

  test('cancelling a parent is refused while a child is open', () => {
    const given = [a.goalOpened(), a.threadOpened(), under('T2', 'Flights')]

    expect(when(given, a.cancelNode())).toEqual({
      refusal: {
        reason: 'Children close first: T2 Flights is still open under T1.',
        fix: threadFix,
      },
    })
  })

  test('resolving a parent is refused while children are open, in ID order', () => {
    const given = [
      a.goalOpened(),
      a.threadOpened(),
      under('T2', 'Places in Greece'),
      under('T3', 'Places in Spain'),
      under('T4', 'Places in Italy'),
      a.threadResolved({ thread: 'T4' }),
    ]

    expect(when(given, a.resolveThread())).toEqual({
      refusal: {
        reason:
          'Children close first: T2 Places in Greece and T3 Places in Spain are still open under T1.',
        fix: threadFix,
      },
    })
  })

  const goalCloses: { name: string; command: Command }[] = [
    { name: 'achieved', command: a.closeGoal() },
    { name: 'failed', command: a.failGoal() },
    { name: 'cancelled', command: a.cancelGoal() },
  ]
  for (const { name, command } of goalCloses) {
    test(`the goal is refused as ${name} while a thread and an action are open`, () => {
      const given = [a.goalOpened(), a.threadOpened(), a.actionAdded()]

      expect(when(given, command)).toEqual({
        refusal: {
          reason:
            'Children close first: T1 Places in Greece and A1 Check school dates are still open under G.',
          fix: goalFix,
        },
      })
    })
  }

  test('the goal is refused while only an action is open', () => {
    expect(when(goalAndAction, a.closeGoal())).toEqual({
      refusal: {
        reason:
          'Children close first: A1 Check school dates is still open under G.',
        fix: goalFix,
      },
    })
  })

  test('the goal is refused while only a thread is open', () => {
    expect(when([a.goalOpened(), a.threadOpened()], a.closeGoal())).toEqual({
      refusal: {
        reason:
          'Children close first: T1 Places in Greece is still open under G.',
        fix: goalFix,
      },
    })
  })

  test('the goal lists its own open threads before its actions, each in ID order, and not deeper ones', () => {
    const given = [
      a.goalOpened(),
      a.threadOpened(),
      a.threadOpened({ thread: 'T2', title: 'Flights' }),
      under('T3', 'Places in Spain'),
      a.actionAdded({ action: 'A1', text: 'Check school dates' }),
      a.actionAdded({ action: 'A2', text: 'Ask the grandparents' }),
    ]

    expect(when(given, a.closeGoal())).toEqual({
      refusal: {
        reason:
          'Children close first: T1 Places in Greece, T2 Flights, A1 Check school dates and A2 Ask the grandparents are still open under G.',
        fix: goalFix,
      },
    })
  })

  test('the goal closes once its threads and actions are closed', () => {
    const given = [
      a.goalOpened(),
      a.threadOpened(),
      a.actionAdded(),
      a.threadResolved(),
      a.actionDone(),
    ]

    expect(when(given, a.closeGoal())).toEqual({
      events: [a.goalAchieved()],
    })
  })
})

describe('close only when nothing is open', () => {
  const FIX =
    'Ask the human how each one ends: the goal achieved, failed or cancelled; each thread resolved or cancelled; each action done, cancelled, or exported to the handoff for filing.'
  const onlyT2Open = [
    a.goalOpened(),
    a.threadOpened(),
    a.actionAdded(),
    a.threadOpened({ thread: 'T2', title: 'Compare the shortlist' }),
    a.threadResolved(),
    a.actionDone(),
    a.goalAchieved(),
  ]

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
        fix: FIX,
      },
    })
  })

  test('refuses the handoff while a thread is open, though the goal and actions are closed', () => {
    expect(when(onlyT2Open, a.writeHandoff())).toEqual({
      refusal: {
        reason: 'Close only when nothing is open: T2 still open.',
        fix: FIX,
      },
    })
  })

  test('names the open goal, threads and actions in that order', () => {
    expect(
      when(
        [
          a.goalOpened(),
          a.threadOpened({ thread: 'T2', title: 'Compare the shortlist' }),
          a.actionAdded(),
        ],
        a.writeHandoff(),
      ),
    ).toEqual({
      refusal: {
        reason: 'Close only when nothing is open: G, T2, A1 still open.',
        fix: FIX,
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
