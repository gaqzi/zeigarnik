import { describe, expect, test } from 'claude-code/testing'

import { AT, a } from './a.ts'
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

  test('a thread opened with a question gets Claude’s question as its first reply', () => {
    expect(
      when(
        [a.goalOpened()],
        a.openThread({ question: 'Best Greek pick is 2h by bus. OK?' }),
      ),
    ).toEqual({
      events: [
        a.threadOpened(),
        a.nodeReplied({
          node: 'T1',
          author: 'claude',
          text: 'Best Greek pick is 2h by bus. OK?',
        }),
      ],
    })
  })

  test('the question goes to the new thread, whatever its number', () => {
    expect(
      when(
        underGoal,
        a.openThread({ parent: 'T1', title: 'Rhodes', question: 'Rhodes OK?' }),
      ),
    ).toEqual({
      events: [
        a.threadOpened({ thread: 'T2', parent: 'T1', title: 'Rhodes' }),
        a.nodeReplied({ node: 'T2', author: 'claude', text: 'Rhodes OK?' }),
      ],
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
    {
      name: 'refuses a thread with a question when no goal is open',
      given: [],
      command: a.openThread({ question: 'Rhodes OK?' }),
      reason:
        "One parent: a thread belongs to the open goal's tree, and no goal is open.",
      fix: 'Open a goal first: the human starts one with /zg:open.',
    },
    {
      name: 'refuses a thread with a question under a parent that does not exist',
      given: underGoal,
      command: a.openThread({ parent: 'T7', question: 'Rhodes OK?' }),
      reason: 'One parent: there is no thread T7.',
      fix: 'The open threads are T1.',
    },
    {
      name: 'refuses a thread with a question under a resolved parent',
      given: [...underGoal, a.threadResolved()],
      command: a.openThread({ parent: 'T1', question: 'Rhodes OK?' }),
      reason: 'One parent: T1 is already resolved.',
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

  describe('a decision and its options', () => {
    const withDecision = [a.goalOpened(), a.decisionOpened()]
    const withOption = [...withDecision, a.optionAdded()]

    test('a decision opens under the open goal as D1', () => {
      expect(when([a.goalOpened()], a.openDecision())).toEqual({
        events: [a.decisionOpened()],
      })
    })

    test('a decision opens under an option, numbered as a decision', () => {
      expect(
        when(
          withOption,
          a.openDecision({ parent: 'D1.1', title: 'Which bus?' }),
        ),
      ).toEqual({
        events: [
          a.decisionOpened({
            decision: 'D2',
            parent: 'D1.1',
            title: 'Which bus?',
          }),
        ],
      })
    })

    test('an option is added to a decision, numbered from D1.1', () => {
      expect(when(withDecision, a.addOption())).toEqual({
        events: [a.optionAdded()],
      })
    })

    test('options are numbered under their decision in the order they come', () => {
      expect(when(withOption, a.addOption({ title: 'Paphos' }))).toEqual({
        events: [a.optionAdded({ option: 'D1.2', title: 'Paphos' })],
      })
    })

    test('a dropped option’s number is not reused', () => {
      const given = [...withOption, a.nodeCancelled({ node: 'D1.1' })]

      expect(when(given, a.addOption({ title: 'Paphos' }))).toEqual({
        events: [a.optionAdded({ option: 'D1.2', title: 'Paphos' })],
      })
    })

    test('a thread opens under an option, numbered across the session', () => {
      const given = [
        ...withOption,
        a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
        a.threadOpened({ thread: 'T2' }),
      ]

      expect(
        when(
          given,
          a.openThread({ parent: 'D1.2', title: 'Check Paphos flights' }),
        ),
      ).toEqual({
        events: [
          a.threadOpened({
            thread: 'T3',
            parent: 'D1.2',
            title: 'Check Paphos flights',
          }),
        ],
      })
    })
  })

  describe('one parent follows the containment table', () => {
    const table = [
      a.goalOpened(),
      a.threadOpened({ thread: 'T1' }),
      a.decisionOpened(),
      a.optionAdded(),
      a.threadOpened({ thread: 'T4' }),
      a.threadResolved({ thread: 'T4' }),
      a.decisionOpened({ decision: 'D2' }),
      a.nodeCancelled({ node: 'D2' }),
    ]
    const rows: {
      name: string
      given: Event[]
      command: Command
      reason: string
      fix: string
    }[] = [
      {
        name: 'an option is refused on a thread',
        given: table,
        command: a.addOption({ decision: 'T1', title: 'X' }),
        reason:
          'One parent: T1 is a thread, and only a decision holds options.',
        fix: 'Open a decision under T1, and add the option there.',
      },
      {
        name: 'a thread is refused under a decision',
        given: table,
        command: a.openThread({ parent: 'D1', title: 'X' }),
        reason: 'One parent: D1 is a decision, and holds only its options.',
        fix: "Open the thread under one of D1's options, or beside D1.",
      },
      {
        name: 'a decision is refused under a decision',
        given: table,
        command: a.openDecision({ parent: 'D1', title: 'X' }),
        reason: 'One parent: D1 is a decision, and holds only its options.',
        fix: "Open the decision under one of D1's options, or beside D1.",
      },
      {
        name: 'an option is refused when the decision already has one with that title',
        given: table,
        command: a.addOption({ decision: 'D1', title: 'Greek village' }),
        reason: 'D1 already has the option Greek village (D1.1).',
        fix: 'Reply to D1.1 instead.',
      },
      {
        name: 'a decision is refused under a resolved thread',
        given: table,
        command: a.openDecision({ parent: 'T4', title: 'X' }),
        reason: 'T4 is already resolved.',
        fix: "Open it under T4's parent G, or under another open node.",
      },
      {
        name: 'an option is refused on a cancelled decision',
        given: table,
        command: a.addOption({ decision: 'D2', title: 'X' }),
        reason: 'D2 is already cancelled.',
        fix: 'The open decisions are D1.',
      },
      {
        name: 'an option is refused on a decision that does not exist',
        given: table,
        command: a.addOption({ decision: 'D9', title: 'X' }),
        reason: 'There is no decision D9.',
        fix: 'The open decisions are D1.',
      },
      {
        name: 'an option is refused on an option',
        given: table,
        command: a.addOption({ decision: 'D1.1', title: 'X' }),
        reason:
          'One parent: D1.1 is an option, and only a decision holds options.',
        fix: 'Open a decision under D1.1, and add the option there.',
      },
      {
        name: 'a decision is refused under a parent that does not exist, naming the parents that would take it',
        given: table,
        command: a.openDecision({ parent: 'T9', title: 'X' }),
        reason: 'There is no node T9.',
        fix: 'Open it under G, T1 or D1.1.',
      },
      {
        name: 'a decision is refused when no goal is open',
        given: [],
        command: a.openDecision({ parent: 'G', title: 'X' }),
        reason:
          "One parent: a decision belongs to the open goal's tree, and no goal is open.",
        fix: 'Open a goal first: the human starts one with /zg:open.',
      },
    ]
    for (const { name, given, command, reason, fix } of rows) {
      test(name, () => {
        expect(when(given, command)).toEqual({ refusal: { reason, fix } })
      })
    }
  })

  describe('the new kinds keep the tree a tree', () => {
    const tree = [
      a.goalOpened(),
      a.decisionOpened(),
      a.optionAdded(),
      a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
      a.decisionOpened({ decision: 'D3', title: 'Which flights?' }),
      a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Direct' }),
      a.threadOpened({ thread: 'T2' }),
    ]
    const rows: {
      name: string
      command: Command
      reason: string
      fix: string
    }[] = [
      {
        name: 'an option does not nest under a thread',
        command: a.nestNode({ node: 'D1.1', parent: 'T2' }),
        reason: 'One parent: an option sits under a decision.',
        fix: 'Nest D1.1 under D3.',
      },
      {
        name: 'an option does not nest under another option',
        command: a.nestNode({ node: 'D1.1', parent: 'D1.2' }),
        reason: 'One parent: an option sits under a decision.',
        fix: 'Nest D1.1 under D3.',
      },
      {
        name: 'a thread does not nest under a decision',
        command: a.nestNode({ node: 'T2', parent: 'D1' }),
        reason: 'One parent: D1 is a decision, and holds only its options.',
        fix: 'Nest T2 under D1.1, D1.2 or D3.1.',
      },
      {
        name: 'options merge only within their decision',
        command: a.mergeNodes({ from: ['D1.1'], into: 'D3.1' }),
        reason: 'One parent: options merge only within their decision.',
        fix: 'Merge D1.1 into another open option of D1, or leave it where it is.',
      },
      {
        name: 'a thread does not merge into a decision',
        command: a.mergeNodes({ from: ['T2'], into: 'D1' }),
        reason: 'One parent: D1 is a decision, and holds only its options.',
        fix: 'Merge T2 into another open thread, or leave it where it is.',
      },
      {
        name: 'decisions do not merge',
        command: a.mergeNodes({ from: ['D1'], into: 'D3' }),
        reason: "One parent: decisions don't merge.",
        fix: "Nest D1's options under D3, add its criteria to D3, then cancel D1 naming D3.",
      },
    ]
    for (const { name, command, reason, fix } of rows) {
      test(`${name}`, () => {
        expect(when(tree, command)).toEqual({ refusal: { reason, fix } })
      })
    }

    test('an option nests under another open decision and keeps its ID', () => {
      expect(when(tree, a.nestNode({ node: 'D1.1', parent: 'D3' }))).toEqual({
        events: [a.nodeMoved({ node: 'D1.1', parent: 'D3' })],
      })
    })

    test('a thread nests under an option', () => {
      expect(when(tree, a.nestNode({ node: 'T2', parent: 'D1.2' }))).toEqual({
        events: [a.nodeMoved({ node: 'T2', parent: 'D1.2' })],
      })
    })

    test('a decision nests under an option', () => {
      expect(when(tree, a.nestNode({ node: 'D3', parent: 'D1.2' }))).toEqual({
        events: [a.nodeMoved({ node: 'D3', parent: 'D1.2' })],
      })
    })
  })

  describe('a node op that names a missing or closed node is answered with the open nodes once decisions and options are among them', () => {
    const dropped = [
      a.goalOpened(),
      a.decisionOpened(),
      a.optionAdded(),
      a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
      a.nodeCancelled({ node: 'D1.1' }),
    ]
    const rows: {
      name: string
      command: Command
      reason: string
      fix: string
    }[] = [
      {
        name: 'cancelling a node that does not exist',
        command: a.cancelNode({ node: 'D1.9' }),
        reason: 'There is no node D1.9.',
        fix: 'The open nodes are D1, D1.2.',
      },
      {
        name: 'nesting a node that does not exist',
        command: a.nestNode({ node: 'D1.9', parent: 'G' }),
        reason: 'One parent: there is no node D1.9.',
        fix: 'The open nodes are D1, D1.2.',
      },
      {
        name: 'merging a node that does not exist',
        command: a.mergeNodes({ from: ['D1.9'], into: 'D1.2' }),
        reason: 'There is no node D1.9.',
        fix: 'The open nodes are D1, D1.2.',
      },
      {
        name: 'replying to a dropped option',
        command: a.replyToNode({ node: 'D1.1' }),
        reason: 'D1.1 is already cancelled.',
        fix: "Open a new thread beside D1, under G, for what's new; the open nodes are D1, D1.2.",
      },
      {
        name: 'moving a reply to a node that does not exist',
        command: a.moveReply({ node: 'D1.2', to: 'D1.9' }),
        reason: 'There is no node D1.9.',
        fix: 'The open nodes are D1, D1.2.',
      },
    ]
    for (const { name, command, reason, fix } of rows) {
      test(name, () => {
        expect(when(dropped, command)).toEqual({ refusal: { reason, fix } })
      })
    }
  })

  describe('a missing or closed parent is answered with parents the table accepts', () => {
    const decision = [
      a.goalOpened(),
      a.threadOpened({ thread: 'T1' }),
      a.decisionOpened(),
      a.optionAdded(),
    ]
    const droppedOption = [...decision, a.nodeCancelled({ node: 'D1.1' })]
    const rows: {
      name: string
      given: Event[]
      command: Command
      reason: string
      fix: string
    }[] = [
      {
        name: 'a thread under a missing parent is sent to the goal and the nodes that can hold a thread',
        given: decision,
        command: a.openThread({ parent: 'T9' }),
        reason: 'One parent: there is no node T9.',
        fix: 'Open it under G, T1 or D1.1.',
      },
      {
        name: 'a missing thread to nest names every open node',
        given: decision,
        command: a.nestNode({ node: 'T9', parent: 'T1' }),
        reason: 'One parent: there is no node T9.',
        fix: 'The open nodes are T1, D1, D1.1.',
      },
      {
        name: 'a merge into a missing thread names every open node',
        given: decision,
        command: a.mergeNodes({ from: ['T1'], into: 'T9' }),
        reason: 'There is no node T9.',
        fix: 'The open nodes are T1, D1, D1.1.',
      },
      {
        name: 'a thread under a cancelled option is sent beside its decision',
        given: droppedOption,
        command: a.openThread({ parent: 'D1.1' }),
        reason: 'One parent: D1.1 is already cancelled.',
        fix: 'Open it beside D1, under G, or under another open thread.',
      },
      {
        name: 'a decision under a cancelled option is sent beside its decision',
        given: droppedOption,
        command: a.openDecision({ parent: 'D1.1', title: 'X' }),
        reason: 'D1.1 is already cancelled.',
        fix: 'Open it beside D1, under G, or under another open node.',
      },
    ]
    for (const { name, given, command, reason, fix } of rows) {
      test(name, () => {
        expect(when(given, command)).toEqual({ refusal: { reason, fix } })
      })
    }
  })
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

describe('moving a reply', () => {
  const first = '2026-10-22T10:00:01.000Z'
  const second = '2026-10-22T10:00:02.000Z'
  const third = '2026-10-22T10:00:03.000Z'
  const base = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T3', title: 'Places in Spain' }),
    a.threadOpened({ thread: 'T4', title: 'Flights' }),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
  ]
  const twoReplies = [
    a.nodeReplied({ node: 'T5', author: 'claude', text: 'Noted', at: first }),
    a.nodeReplied({ node: 'T5', text: 'that was about Spain', at: second }),
  ]

  test('the reply named by its ordinal moves, the event holding when it was said', () => {
    const given = [...base, ...twoReplies]

    expect(when(given, a.moveReply({ ordinal: 1 }))).toEqual({
      events: [a.replyMoved({ reply: first })],
    })
  })

  test('the latest reply moves when no ordinal is named', () => {
    const given = [...base, ...twoReplies]

    expect(when(given, a.moveReply())).toEqual({
      events: [a.replyMoved({ reply: second })],
    })
  })

  describe('ordinals re-derive after a move', () => {
    const given = [
      ...base,
      ...twoReplies,
      a.nodeReplied({ node: 'T5', author: 'claude', text: 'Right', at: third }),
      a.replyMoved({ reply: second }),
    ]

    test('the reply that was number 3 is now number 2', () => {
      expect(when(given, a.moveReply({ ordinal: 2 }))).toEqual({
        events: [a.replyMoved({ reply: third })],
      })
    })

    test('number 3 no longer exists', () => {
      expect(when(given, a.moveReply({ ordinal: 3 }))).toEqual({
        refusal: {
          reason: 'T5 has 2 replies, none numbered 3.',
          fix: 'Pass an ordinal from 1 to 2, as show numbers them, or leave it out for the latest.',
        },
      })
    })
  })

  const refusedGiven = [
    ...base.slice(0, 3),
    a.threadResolved({ thread: 'T4' }),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
    a.threadOpened({ thread: 'T7', title: 'Spain again' }),
    a.nodeMerged({ from: ['T7'], into: 'T5' }),
    ...twoReplies,
  ]
  const openThreads = 'The open threads are T3, T5.'
  const refused: {
    name: string
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'refuses an ordinal past the last reply',
      command: a.moveReply({ ordinal: 7 }),
      reason: 'T5 has 2 replies, none numbered 7.',
      fix: 'Pass an ordinal from 1 to 2, as show numbers them, or leave it out for the latest.',
    },
    {
      name: 'refuses a move to a resolved thread',
      command: a.moveReply({ ordinal: 2, to: 'T4' }),
      reason: 'T4 is already resolved.',
      fix: openThreads,
    },
    {
      name: 'refuses a move to a merged thread, naming where it went',
      command: a.moveReply({ ordinal: 2, to: 'T7' }),
      reason: 'T7 is already merged.',
      fix: 'T7 was merged into T5; work on T5 instead.',
    },
    {
      name: 'refuses a move to the thread the reply is already on',
      command: a.moveReply({ ordinal: 2, to: 'T5' }),
      reason: 'The reply is already on T5.',
      fix: 'Pass the thread the reply belongs on as to.',
    },
    {
      name: 'refuses a move from a thread with no replies',
      command: a.moveReply({ node: 'T3', to: 'T5' }),
      reason: 'T3 has no replies.',
      fix: "Name the thread that holds the reply as id; show lists each thread's replies.",
    },
    {
      name: 'refuses a move from a thread that does not exist',
      command: a.moveReply({ node: 'T9' }),
      reason: 'There is no thread T9.',
      fix: openThreads,
    },
    {
      name: 'refuses a move to a thread that does not exist',
      command: a.moveReply({ to: 'T9' }),
      reason: 'There is no thread T9.',
      fix: openThreads,
    },
    {
      name: 'names the missing source before the missing destination',
      command: a.moveReply({ node: 'T9', to: 'T8' }),
      reason: 'There is no thread T9.',
      fix: openThreads,
    },
  ]
  for (const { name, command, reason, fix } of refused) {
    test(name, () => {
      expect(when(refusedGiven, command)).toEqual({ refusal: { reason, fix } })
    })
  }

  test('says reply, not replies, when the thread has one', () => {
    const given = [...base, ...twoReplies.slice(0, 1)]

    expect(when(given, a.moveReply({ ordinal: 2 }))).toEqual({
      refusal: {
        reason: 'T5 has 1 reply, none numbered 2.',
        fix: 'Pass an ordinal from 1 to 1, as show numbers them, or leave it out for the latest.',
      },
    })
  })

  describe('a closed thread keeps its replies', () => {
    const closedGiven = [
      ...base,
      a.nodeReplied({ node: 'T4', text: 'Flights are booked', at: first }),
      a.threadResolved({ thread: 'T4' }),
      a.threadOpened({ thread: 'T6', title: 'Ferries' }),
      a.nodeReplied({ node: 'T6', text: 'Ferries too', at: first }),
      a.nodeMerged({ from: ['T6'], into: 'T5' }),
    ]
    const closedRefused: {
      name: string
      command: Command
      reason: string
      fix: string
    }[] = [
      {
        name: 'refuses to move a reply off a resolved thread',
        command: a.moveReply({ node: 'T4', to: 'T3' }),
        reason: 'T4 is already resolved.',
        fix: 'A closed thread keeps its replies; reply on the right thread with the words instead.',
      },
      {
        name: 'refuses to move a reply off a merged thread, naming where it went',
        command: a.moveReply({ node: 'T6', to: 'T3' }),
        reason: 'T6 is already merged.',
        fix: 'T6 was merged into T5; work on T5 instead.',
      },
    ]
    for (const { name, command, reason, fix } of closedRefused) {
      test(name, () => {
        expect(when(closedGiven, command)).toEqual({
          refusal: { reason, fix },
        })
      })
    }
  })

  describe('replies recorded at the same moment cannot be told apart', () => {
    const fix =
      'Leave them where they are; reply on the right thread with the words instead.'

    test('refuses the reply when the next one shares its moment', () => {
      const given = [
        ...base,
        a.nodeReplied({ node: 'T5', text: 'one', at: first }),
        a.nodeReplied({ node: 'T5', text: 'two', at: first }),
      ]

      expect(when(given, a.moveReply({ ordinal: 1 }))).toEqual({
        refusal: {
          reason:
            "T5's replies #1 and #2 were recorded at the same moment, so zg can't tell them apart.",
          fix,
        },
      })
    })

    test('names the pair as the lower number first, whichever of them is moved', () => {
      const given = [
        ...base,
        a.nodeReplied({ node: 'T5', text: 'one', at: first }),
        a.nodeReplied({ node: 'T5', text: 'two', at: second }),
        a.nodeReplied({ node: 'T5', text: 'three', at: second }),
      ]

      expect(when(given, a.moveReply({ ordinal: 3 }))).toEqual({
        refusal: {
          reason:
            "T5's replies #2 and #3 were recorded at the same moment, so zg can't tell them apart.",
          fix,
        },
      })
    })

    test('refuses the reply when the destination already holds one from the same moment', () => {
      const given = [
        ...base,
        a.nodeReplied({ node: 'T3', text: 'Spain is out', at: second }),
        a.nodeReplied({ node: 'T5', text: 'one', at: first }),
        a.nodeReplied({ node: 'T5', text: 'two', at: second }),
      ]

      expect(when(given, a.moveReply({ ordinal: 2 }))).toEqual({
        refusal: {
          reason:
            "T3 already holds a reply recorded at the same moment as T5's #2, so zg couldn't tell them apart.",
          fix: 'Leave it where it is; reply on T3 with the words instead.',
        },
      })
    })
  })
})

describe('closing says how, for a decision', () => {
  const holiday = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
  ]

  test('a pick appends exactly the DecisionMade, and nothing for the options', () => {
    expect(when(holiday, a.makeDecision())).toEqual({
      events: [a.decisionMade()],
    })
  })

  const outline = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
    a.decisionOpened({ decision: 'D3', title: 'Which flights?' }),
    a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Direct' }),
    a.decisionMade({ decision: 'D3', option: 'D3.1' }),
    a.threadOpened({ thread: 'T1' }),
  ]
  const fix = "D1's open options are D1.2."
  const rows: {
    name: string
    given: Event[]
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'refuses a pick of an option already cancelled',
      given: outline,
      command: a.makeDecision({ option: 'D1.1' }),
      reason: 'Closing says how: D1.1 is already cancelled.',
      fix,
    },
    {
      name: 'refuses a pick of an option the decision does not have',
      given: outline,
      command: a.makeDecision({ option: 'D1.9' }),
      reason: 'D1 has no option D1.9.',
      fix,
    },
    {
      name: 'refuses a pick of another decision’s option',
      given: outline,
      command: a.makeDecision({ option: 'D3.1' }),
      reason: "D3.1 is not one of D1's options.",
      fix,
    },
    {
      name: 'refuses picking the option a decided decision already has chosen',
      given: outline,
      command: a.makeDecision({ decision: 'D3', option: 'D3.1' }),
      reason: 'D3.1 is already chosen.',
      fix: 'Pick another option, or a new one.',
    },
    {
      name: 'refuses deciding a thread',
      given: outline,
      command: a.makeDecision({ decision: 'T1', option: 'D1.2' }),
      reason: 'T1 is a thread, not a decision.',
      fix: 'Resolve T1 with an outcome, or decide D1.',
    },
    {
      name: 'refuses deciding a decision with no open option',
      given: [...outline, a.nodeCancelled({ node: 'D1.2' })],
      command: a.makeDecision({ option: 'D1.2' }),
      reason: 'Closing says how: D1 has no open option.',
      fix: 'Add one, or cancel D1.',
    },
    {
      name: 'refuses deciding with an option as the decision',
      given: holiday,
      command: a.makeDecision({ decision: 'D1.3' }),
      reason: 'D1.3 is an option, not a decision.',
      fix: 'Decide D1 with option D1.3.',
    },
    {
      name: 'refuses resolving a decision',
      given: outline,
      command: a.resolveThread({ thread: 'D1', outcome: 'Paphos' }),
      reason: 'Closing says how: D1 is a decision.',
      fix: 'Decide it with an option, or cancel it.',
    },
    {
      name: 'refuses resolving an option',
      given: outline,
      command: a.resolveThread({ thread: 'D1.2', outcome: 'Costa del Sol' }),
      reason: 'Closing says how: D1.2 is an option.',
      fix: 'Decide D1, or cancel D1.2.',
    },
  ]
  for (const { name, given, command, reason, fix } of rows) {
    test(name, () => {
      expect(when(given, command)).toEqual({ refusal: { reason, fix } })
    })
  }
})

describe('children close first, for a decision', () => {
  const holiday = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
  ]
  const fix =
    'Show the human the open children and ask how each ends, or propose one outcome that settles them for the human to confirm.'
  const flights = (parent: string) =>
    a.threadOpened({
      thread: 'T6',
      parent,
      title: 'Check Paphos flights',
    })

  test('its options being open does not stop it being decided', () => {
    expect(when(holiday, a.makeDecision())).toEqual({
      events: [a.decisionMade()],
    })
  })

  test('its options being open does not stop it being cancelled, and only it is cancelled', () => {
    expect(when(holiday, a.cancelNode({ node: 'D1' }))).toEqual({
      events: [a.nodeCancelled({ node: 'D1' })],
    })
  })

  test('a pick is refused while a thread is open under the option picked', () => {
    expect(when([...holiday, flights('D1.3')], a.makeDecision())).toEqual({
      refusal: {
        reason:
          'Children close first: T6 Check Paphos flights is still open under D1.3.',
        fix,
      },
    })
  })

  test('a pick is refused while a thread is open under an option not picked', () => {
    expect(when([...holiday, flights('D1.2')], a.makeDecision())).toEqual({
      refusal: {
        reason:
          'Children close first: T6 Check Paphos flights is still open under D1.2.',
        fix,
      },
    })
  })

  test('cancelling the decision is refused while a thread is open under an option', () => {
    expect(
      when([...holiday, flights('D1.3')], a.cancelNode({ node: 'D1' })),
    ).toEqual({
      refusal: {
        reason:
          'Children close first: T6 Check Paphos flights is still open under D1.3.',
        fix,
      },
    })
  })

  const costaFlights = a.threadOpened({
    thread: 'T7',
    parent: 'D1.2',
    title: 'Check Costa flights',
  })
  const bothOpen = [...holiday, costaFlights, flights('D1.3')]
  const bothRefused = {
    refusal: {
      reason:
        'Children close first: T7 Check Costa flights is still open under D1.2. T6 Check Paphos flights is still open under D1.3.',
      fix,
    },
  }

  test('a pick is refused with every option’s open threads, one sentence per option in ID order', () => {
    expect(when(bothOpen, a.makeDecision())).toEqual(bothRefused)
  })

  test('cancelling the decision is refused with every option’s open threads, one sentence per option in ID order', () => {
    expect(when(bothOpen, a.cancelNode({ node: 'D1' }))).toEqual(bothRefused)
  })

  test('options are listed in sibling order, not log order, when an option nested under the decision was opened first', () => {
    const given = [
      a.goalOpened(),
      a.decisionOpened({ decision: 'D2', title: 'Which flights?' }),
      a.optionAdded({ option: 'D2.1', decision: 'D2', title: 'Rhodes' }),
      a.decisionOpened(),
      a.optionAdded({ option: 'D1.1', title: 'Paphos' }),
      a.nodeMoved({ node: 'D2.1', parent: 'D1', source: 'chat' }),
      a.threadOpened({
        thread: 'T1',
        parent: 'D2.1',
        title: 'Check Rhodes flights',
      }),
      a.threadOpened({
        thread: 'T2',
        parent: 'D1.1',
        title: 'Check Paphos flights',
      }),
    ]

    expect(when(given, a.makeDecision({ option: 'D1.1' }))).toEqual({
      refusal: {
        reason:
          'Children close first: T2 Check Paphos flights is still open under D1.1. T1 Check Rhodes flights is still open under D2.1.',
        fix,
      },
    })
  })

  test('a pick goes through once the thread under the option has closed', () => {
    const given = [
      ...holiday,
      flights('D1.3'),
      a.threadResolved({ thread: 'T6' }),
    ]

    expect(when(given, a.makeDecision())).toEqual({
      events: [a.decisionMade()],
    })
  })
})

describe('a decided or cancelled decision and its ended options take nothing more', () => {
  const decided = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.threadOpened({ thread: 'T1', title: 'Places in Greece' }),
    a.decisionOpened({ decision: 'D2', title: 'Which flights?' }),
    a.decisionMade(),
  ]
  const cancelled = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.threadOpened({ thread: 'T1', title: 'Places in Greece' }),
    a.decisionOpened({ decision: 'D2', title: 'Which flights?' }),
    a.nodeCancelled({ node: 'D1' }),
  ]
  const decidedWide = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.nodeReplied({ node: 'D1.2', text: 'bars, easy flights' }),
    a.threadOpened({ thread: 'T1', title: 'Places in Greece' }),
    a.nodeReplied({ node: 'T1', text: 'Rhodes first' }),
    a.decisionOpened({ decision: 'D2', title: 'Which flights?' }),
    a.optionAdded({ option: 'D2.1', decision: 'D2', title: 'Direct' }),
    a.optionAdded({ option: 'D2.2', decision: 'D2', title: 'Via Athens' }),
    a.decisionMade(),
  ]
  const rows: {
    name: string
    given: Event[]
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'a reply to a decided decision',
      given: decided,
      command: a.replyToNode({ node: 'D1' }),
      reason: 'D1 is already decided.',
      fix: "Open a new thread under D1's parent for what's new; the open nodes are T1, D2.",
    },
    {
      name: 'a reply to the option chosen',
      given: decided,
      command: a.replyToNode({ node: 'D1.3' }),
      reason: 'D1.3 is already chosen.',
      fix: "Open a new thread beside D1, under G, for what's new; the open nodes are T1, D2.",
    },
    {
      name: 'a reply to an option not chosen',
      given: decided,
      command: a.replyToNode({ node: 'D1.2' }),
      reason: 'D1.2 is already not chosen.',
      fix: "Open a new thread beside D1, under G, for what's new; the open nodes are T1, D2.",
    },
    {
      name: 'an option added to a decided decision',
      given: decided,
      command: a.addOption({ title: 'Rhodes' }),
      reason: 'D1 is already decided.',
      fix: 'Pick a new option with decide, which adds it chosen.',
    },
    {
      name: 'a thread opened under a decided decision',
      given: decided,
      command: a.openThread({ parent: 'D1' }),
      reason: 'One parent: D1 is already decided.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a thread opened under the option chosen',
      given: decided,
      command: a.openThread({ parent: 'D1.3' }),
      reason: 'One parent: D1.3 is already chosen.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a decision opened under a decided decision',
      given: decided,
      command: a.openDecision({ parent: 'D1', title: 'X' }),
      reason: 'D1 is already decided.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a decision opened under an option not chosen',
      given: decided,
      command: a.openDecision({ parent: 'D1.2', title: 'X' }),
      reason: 'D1.2 is already not chosen.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a decided decision nested under a thread',
      given: decided,
      command: a.nestNode({ node: 'D1', parent: 'T1' }),
      reason: 'D1 is already decided.',
      fix: 'Leave D1 where it is; the open nodes are T1, D2.',
    },
    {
      name: 'an option not chosen nested under another decision',
      given: decidedWide,
      command: a.nestNode({ node: 'D1.2', parent: 'D2' }),
      reason: 'D1.2 is already not chosen.',
      fix: 'Leave D1.2 where it is; the open nodes are T1, D2, D2.1, D2.2.',
    },
    {
      name: 'a thread nested under a decided decision',
      given: decidedWide,
      command: a.nestNode({ node: 'T1', parent: 'D1' }),
      reason: 'One parent: D1 is already decided.',
      fix: 'Nest T1 under D2.1 or D2.2.',
    },
    {
      name: 'a thread nested under the option chosen',
      given: decidedWide,
      command: a.nestNode({ node: 'T1', parent: 'D1.3' }),
      reason: 'One parent: D1.3 is already chosen.',
      fix: 'Nest T1 under D2.1 or D2.2.',
    },
    {
      name: 'an option not chosen merged into the option chosen',
      given: decidedWide,
      command: a.mergeNodes({ from: ['D1.2'], into: 'D1.3' }),
      reason: 'D1.2 is already not chosen.',
      fix: 'Leave D1.2 where it is; the open nodes are T1, D2, D2.1, D2.2.',
    },
    {
      name: 'an option of another decision merged into the option chosen',
      given: decidedWide,
      command: a.mergeNodes({ from: ['D2.1'], into: 'D1.3' }),
      reason: 'D1.3 is already chosen.',
      fix: 'Merge D2.1 into another open option of D2, or leave it where it is.',
    },
    {
      name: 'a reply moved off an option not chosen',
      given: decidedWide,
      command: a.moveReply({ node: 'D1.2', to: 'T1' }),
      reason: 'D1.2 is already not chosen.',
      fix: 'D1.2 keeps its replies; reply with the words on the right node instead: the open nodes are T1, D2, D2.1, D2.2.',
    },
    {
      name: 'a reply moved onto an option not chosen',
      given: decidedWide,
      command: a.moveReply({ node: 'T1', to: 'D1.2' }),
      reason: 'D1.2 is already not chosen.',
      fix: 'The open nodes are T1, D2, D2.1, D2.2.',
    },
    {
      name: 'a reply to a cancelled decision',
      given: cancelled,
      command: a.replyToNode({ node: 'D1' }),
      reason: 'D1 is already cancelled.',
      fix: "Open a new thread under D1's parent for what's new; the open nodes are T1, D2.",
    },
    {
      name: 'a reply to an option cancelled with its decision',
      given: cancelled,
      command: a.replyToNode({ node: 'D1.2' }),
      reason: 'D1.2 is already cancelled.',
      fix: "Open a new thread beside D1, under G, for what's new; the open nodes are T1, D2.",
    },
    {
      name: 'an option added to a cancelled decision',
      given: cancelled,
      command: a.addOption({ title: 'Rhodes' }),
      reason: 'D1 is already cancelled.',
      fix: 'The open decisions are D2.',
    },
    {
      name: 'a thread opened under a cancelled decision',
      given: cancelled,
      command: a.openThread({ parent: 'D1' }),
      reason: 'One parent: D1 is already cancelled.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a thread opened under an option cancelled with its decision',
      given: cancelled,
      command: a.openThread({ parent: 'D1.2' }),
      reason: 'One parent: D1.2 is already cancelled.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a decision opened under a cancelled decision',
      given: cancelled,
      command: a.openDecision({ parent: 'D1', title: 'X' }),
      reason: 'D1 is already cancelled.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a decision opened under an option cancelled with its decision',
      given: cancelled,
      command: a.openDecision({ parent: 'D1.2', title: 'X' }),
      reason: 'D1.2 is already cancelled.',
      fix: 'Open it under G or T1.',
    },
    {
      name: 'a cancelled decision nested under a thread',
      given: cancelled,
      command: a.nestNode({ node: 'D1', parent: 'T1' }),
      reason: 'D1 is already cancelled.',
      fix: 'Leave D1 where it is; the open nodes are T1, D2.',
    },
  ]
  for (const { name, given, command, reason, fix } of rows) {
    test(`refuses ${name}`, () => {
      expect(when(given, command)).toEqual({ refusal: { reason, fix } })
    })
  }
})

describe('a decided decision with its options counts as closed', () => {
  const decided = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.decisionMade(),
  ]

  test('the goal closes', () => {
    expect(when(decided, a.closeGoal())).toEqual({
      events: [a.goalAchieved()],
    })
  })

  test('the handoff is written once the goal is closed', () => {
    const given = [...decided, a.goalAchieved()]

    expect(when(given, a.writeHandoff())).toEqual({
      events: [a.handoffWritten()],
    })
  })
})

describe('a criterion attaches to a decision', () => {
  const outline = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T2' }),
    a.decisionOpened(),
    a.decisionOpened({ decision: 'D2', title: 'Which flights?' }),
    a.optionAdded({ option: 'D2.1', decision: 'D2', title: 'Direct' }),
    a.decisionMade({ decision: 'D2', option: 'D2.1' }),
    a.decisionOpened({ decision: 'D5', title: 'Which hotel?' }),
    a.nodeCancelled({ node: 'D5' }),
  ]
  const fix = 'The open decisions are D1.'
  const refused: {
    name: string
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'refuses a criterion on a thread',
      command: a.addCriterion({ on: 'T2' }),
      reason:
        'One parent: a criterion belongs to a decision, and T2 is a thread.',
      fix: 'Open the decision it serves under T2, or attach it to D1.',
    },
    {
      name: 'refuses a criterion on the goal',
      command: a.addCriterion({ on: 'G' }),
      reason: 'One parent: a criterion belongs to a decision, not the goal.',
      fix: 'Open the decision it serves.',
    },
    {
      name: 'refuses a criterion on a cancelled decision',
      command: a.addCriterion({ on: 'D5' }),
      reason: 'D5 is already cancelled.',
      fix,
    },
    {
      name: 'refuses a criterion on a decision that does not exist',
      command: a.addCriterion({ on: 'D9' }),
      reason: 'There is no decision D9.',
      fix,
    },
    {
      name: 'refuses a criterion whose origin does not exist',
      command: a.addCriterion({ origin: 'T9' }),
      reason: 'There is no node T9.',
      fix: 'Name the node it came up in, or leave origin out.',
    },
  ]
  for (const { name, command, reason, fix } of refused) {
    test(name, () => {
      expect(when(outline, command)).toEqual({ refusal: { reason, fix } })
    })
  }

  test('an open decision gains the criterion, numbered C1', () => {
    expect(when(outline, a.addCriterion())).toEqual({
      events: [a.criterionAdded()],
    })
  })

  test('a decided decision gains the criterion that its open sub-decisions inherit', () => {
    const given = [
      ...outline,
      a.decisionOpened({
        decision: 'D6',
        parent: 'D2.1',
        title: 'Which airline?',
      }),
    ]

    expect(when(given, a.addCriterion({ on: 'D2' }))).toEqual({
      events: [a.criterionAdded({ on: 'D2' })],
    })
  })

  test('a decided decision with no open decision under its options keeps its words out of a criterion', () => {
    expect(when(outline, a.addCriterion({ on: 'D2' }))).toEqual({
      refusal: {
        reason:
          'D2 is already decided, and no open decision under its options would be judged on it.',
        fix: 'Record it as a reply on the thread it came up in, or open a thread under G for it.',
      },
    })
  })

  test('the fix names the open goal when it is not the first', () => {
    const given = [
      ...outline,
      a.goalAchieved(),
      a.goalOpened({ goal: 'G2', text: 'Pick a hotel' }),
    ]

    expect(when(given, a.addCriterion({ on: 'D2' }))).toEqual({
      refusal: {
        reason:
          'D2 is already decided, and no open decision under its options would be judged on it.',
        fix: 'Record it as a reply on the thread it came up in, or open a thread under G2 for it.',
      },
    })
  })

  test('the fix points to opening a goal when no goal is open', () => {
    const given = [...outline, a.goalAchieved()]

    expect(when(given, a.addCriterion({ on: 'D2' }))).toEqual({
      refusal: {
        reason:
          'D2 is already decided, and no open decision under its options would be judged on it.',
        fix: 'Record it as a reply on the thread it came up in. Open a goal first: the human starts one with /zg:open.',
      },
    })
  })

  test('a decision cancelled under the decided one does not count as open below', () => {
    const given = [
      ...outline,
      a.decisionOpened({
        decision: 'D6',
        parent: 'D2.1',
        title: 'Which airline?',
      }),
      a.nodeCancelled({ node: 'D6' }),
    ]

    expect(when(given, a.addCriterion({ on: 'D2' }))).toEqual({
      refusal: {
        reason:
          'D2 is already decided, and no open decision under its options would be judged on it.',
        fix: 'Record it as a reply on the thread it came up in, or open a thread under G for it.',
      },
    })
  })

  test('the next criterion is numbered by nextId across the session', () => {
    expect(
      when([...outline, a.criterionAdded({ on: 'D2' })], a.addCriterion()),
    ).toEqual({ events: [a.criterionAdded({ criterion: 'C2' })] })
  })

  test('a criterion keeps the origin it came up in, though that node is closed', () => {
    expect(when(outline, a.addCriterion({ origin: 'D2' }))).toEqual({
      events: [a.criterionAdded({ origin: 'D2' })],
    })
  })

  test('a criterion may come up in the goal', () => {
    expect(when(outline, a.addCriterion({ origin: 'G' }))).toEqual({
      events: [a.criterionAdded({ origin: 'G' })],
    })
  })
})

describe('a revision names what changed it', () => {
  const outline = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T5' }),
    a.decisionOpened(),
    a.decisionOpened({ decision: 'D2', title: 'Which flights?' }),
    a.optionAdded({ option: 'D2.1', decision: 'D2', title: 'Direct' }),
    a.decisionMade({ decision: 'D2', option: 'D2.1' }),
    a.criterionAdded(),
    a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
  ]
  const refused: {
    name: string
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'refuses a criterion that does not exist',
      command: a.reviseCriterion({ id: 'C9' }),
      reason: 'There is no criterion C9.',
      fix: 'The criteria are C1, C2.',
    },
    {
      name: 'refuses an origin that does not exist',
      command: a.reviseCriterion({ origin: 'T9' }),
      reason: 'There is no node T9.',
      fix: 'Name the node the change came from.',
    },
    {
      name: 'refuses the wording the criterion already has',
      command: a.reviseCriterion({ text: 'sea ≥ 18°C' }),
      reason: 'C2 already says that.',
      fix: 'Revise it only when the wording changes.',
    },
    {
      name: 'refuses the wording it already has once trimmed',
      command: a.reviseCriterion({ text: '  sea ≥ 18°C  ' }),
      reason: 'C2 already says that.',
      fix: 'Revise it only when the wording changes.',
    },
  ]
  for (const { name, command, reason, fix } of refused) {
    test(name, () => {
      expect(when(outline, command)).toEqual({ refusal: { reason, fix } })
    })
  }

  test('a session with no criteria says so in the same shape', () => {
    expect(when(outline.slice(0, 6), a.reviseCriterion({ id: 'C9' }))).toEqual({
      refusal: {
        reason: 'There is no criterion C9.',
        fix: 'There are no criteria.',
      },
    })
  })

  test('the revision is the criterion, its new text and the node that changed it', () => {
    expect(when(outline, a.reviseCriterion())).toEqual({
      events: [a.criterionRevised()],
    })
  })

  const origins = [
    { name: 'an open thread', origin: 'T5' },
    { name: 'a decided decision', origin: 'D2' },
    { name: 'the goal', origin: 'G' },
  ]
  for (const { name, origin } of origins) {
    test(`may come from ${name}`, () => {
      expect(when(outline, a.reviseCriterion({ origin }))).toEqual({
        events: [a.criterionRevised({ origin })],
      })
    })
  }

  test('is allowed while the criterion’s decision is decided', () => {
    const given = [
      ...outline,
      a.optionAdded({ option: 'D1.1', title: 'Paphos' }),
      a.decisionMade({ decision: 'D1', option: 'D1.1' }),
    ]

    expect(when(given, a.reviseCriterion())).toEqual({
      events: [a.criterionRevised()],
    })
  })

  test('is refused while the criterion’s decision is cancelled', () => {
    const given = [...outline, a.nodeCancelled({ node: 'D1' })]

    expect(when(given, a.reviseCriterion())).toEqual({
      refusal: {
        reason: 'D1 is already cancelled.',
        fix: 'There are no open decisions.',
      },
    })
  })
})

describe('a decision is decided again', () => {
  const decided = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.decisionMade(),
  ]
  const again = 'Paphos flights got cancelled, Costa del Sol it is'

  test('with one of its options that was not chosen, appends exactly the DecisionMade', () => {
    expect(
      when(decided, a.makeDecision({ option: 'D1.2', reason: again })),
    ).toEqual({
      events: [a.decisionMade({ option: 'D1.2', reason: again })],
    })
  })

  test('with a new option, appends OptionAdded then DecisionMade at the command’s time', () => {
    const at = '2026-10-23T09:30:00.000Z'

    expect(
      when(decided, a.pickNewOption({ at, title: 'Rhodes', reason: again })),
    ).toEqual({
      events: [
        a.optionAdded({ at, option: 'D1.4', title: 'Rhodes' }),
        a.decisionMade({ at, option: 'D1.4', reason: again }),
      ],
    })
  })

  test('with a new option on an open decision, adds it and decides it in one command', () => {
    const open = [
      a.goalOpened(),
      a.decisionOpened(),
      a.optionAdded({ option: 'D1.1', title: 'Greek village' }),
    ]

    expect(when(open, a.pickNewOption({ title: 'Rhodes' }))).toEqual({
      events: [
        a.optionAdded({ option: 'D1.2', title: 'Rhodes' }),
        a.decisionMade({ option: 'D1.2' }),
      ],
    })
  })

  test('children close first does not apply: an open thread under an option of the decided decision stops neither pick', () => {
    const exploring = [
      ...decided,
      a.threadOpened({
        thread: 'T6',
        parent: 'D1.2',
        title: 'Check Costa flights',
      }),
    ]

    expect([
      when(exploring, a.makeDecision({ option: 'D1.2' })),
      when(exploring, a.pickNewOption({ title: 'Rhodes' })),
    ]).toEqual([
      { events: [a.decisionMade({ option: 'D1.2' })] },
      {
        events: [
          a.optionAdded({ option: 'D1.4', title: 'Rhodes' }),
          a.decisionMade({ option: 'D1.4' }),
        ],
      },
    ])
  })
})

describe('a rediscussion that needs exploring is a thread, and the decision is unchanged', () => {
  const given = [
    a.goalOpened(),
    a.threadOpened({ thread: 'T5', title: '2h bus?' }),
    a.decisionOpened({
      decision: 'D2',
      parent: 'T5',
      title: 'How long may the transfer be?',
    }),
    a.optionAdded({
      option: 'D2.1',
      decision: 'D2',
      title: 'transfers ≤ 30 min',
    }),
    a.decisionMade({ decision: 'D2', option: 'D2.1' }),
    a.threadResolved({ thread: 'T5' }),
  ]
  const revisit = a.threadOpened({
    thread: 'T6',
    title: 'Revisit the transfer limit (D2)',
  })

  test('opens under the goal and appends only the ThreadOpened', () => {
    expect(
      when(
        given,
        a.openThread({ parent: 'G', title: 'Revisit the transfer limit (D2)' }),
      ),
    ).toEqual({ events: [revisit] })
  })

  test('leaves D2 decided with its pick', () => {
    const state = fold([...given, revisit])
    const decision = state.nodes.find(node => node.id === 'D2')

    expect({ status: decision?.status, picks: decision?.picks }).toEqual({
      status: 'decided',
      picks: [
        {
          option: 'D2.1',
          source: 'chat',
          reason: 'Paphos then, the 20 min transfer settles it',
          at: AT,
        },
      ],
    })
  })
})

describe('the past is not rewritten', () => {
  const outline = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
    a.decisionMade(),
    a.decisionOpened({ decision: 'D7', title: 'Which flights?' }),
    a.nodeCancelled({ node: 'D7' }),
    a.threadOpened({ thread: 'T1', title: 'Places in Greece' }),
  ]
  const rows: {
    name: string
    command: Command
    reason: string
    fix: string
  }[] = [
    {
      name: 'a new option on a cancelled decision',
      command: a.pickNewOption({ decision: 'D7', title: 'X' }),
      reason: 'D7 is already cancelled.',
      fix: 'Open a new decision, naming D7.',
    },
    {
      name: 'a pick on a cancelled decision',
      command: a.makeDecision({ decision: 'D7', option: 'D7.1' }),
      reason: 'D7 is already cancelled.',
      fix: 'Open a new decision, naming D7.',
    },
    {
      name: 'a pick of an option already cancelled',
      command: a.makeDecision({ option: 'D1.1' }),
      reason: 'Closing says how: D1.1 is already cancelled.',
      fix: "D1's other options are D1.3; or name a new one.",
    },
    {
      name: 'a pick of the option already chosen',
      command: a.makeDecision({ option: 'D1.3' }),
      reason: 'D1.3 is already chosen.',
      fix: 'Pick another option, or a new one.',
    },
    {
      name: 'a new option with the title of an existing one',
      command: a.pickNewOption({ title: 'Paphos' }),
      reason: 'D1 already has the option Paphos (D1.3).',
      fix: 'Pick D1.3, or name a different option.',
    },
    {
      name: 'an option added to a decided decision',
      command: a.addOption({ title: 'X' }),
      reason: 'D1 is already decided.',
      fix: 'Pick a new option with decide, which adds it chosen.',
    },
  ]
  for (const { name, command, reason, fix } of rows) {
    test(`refuses ${name}`, () => {
      expect(when(outline, command)).toEqual({ refusal: { reason, fix } })
    })
  }
})

describe('a new option’s title is a twin only of options that are not cancelled', () => {
  const decided = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.1', title: 'Greek village' }),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
    a.decisionMade(),
  ]

  test('accepts the title of an option that was dropped, as the next option', () => {
    expect(when(decided, a.pickNewOption({ title: 'Greek village' }))).toEqual({
      events: [
        a.optionAdded({ option: 'D1.4', title: 'Greek village' }),
        a.decisionMade({ option: 'D1.4' }),
      ],
    })
  })

  test('refuses the title of an option that was not chosen, naming it', () => {
    expect(when(decided, a.pickNewOption({ title: 'Costa del Sol' }))).toEqual({
      refusal: {
        reason: 'D1 already has the option Costa del Sol (D1.2).',
        fix: 'Pick D1.2, or name a different option.',
      },
    })
  })
})

describe('one parent: a decision is decided again only within the open goal’s tree', () => {
  const closed = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.decisionMade(),
    a.goalAchieved(),
  ]
  const commands: { name: string; command: Command }[] = [
    {
      name: 'a pick of an option that was not chosen',
      command: a.makeDecision({ option: 'D1.2' }),
    },
    {
      name: 'a new option',
      command: a.pickNewOption({ title: 'Rhodes' }),
    },
  ]
  const rows: {
    name: string
    given: Event[]
    reason: string
    fix: string
  }[] = [
    {
      name: 'no goal is open',
      given: closed,
      reason:
        "One parent: a decision belongs to the open goal's tree, and no goal is open.",
      fix: 'Open a goal first: the human starts one with /zg:open.',
    },
    {
      name: 'another goal is open',
      given: [...closed, a.goalOpened({ goal: 'G2' })],
      reason: 'D1 belongs to a closed goal.',
      fix: 'Open a new decision under the open goal, naming D1.',
    },
  ]
  for (const { name, given, reason, fix } of rows) {
    for (const { name: what, command } of commands) {
      test(`refuses ${what} on a decision whose goal is closed when ${name}`, () => {
        expect(when(given, command)).toEqual({ refusal: { reason, fix } })
      })
    }
  }
})
