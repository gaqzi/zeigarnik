import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import { details } from './details.ts'
import type { Event } from './events.ts'
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

describe('a decision and its options', () => {
  const holiday = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
    a.nodeReplied({
      node: 'D1.1',
      text: 'best beach of the lot, but 2h by bus',
    }),
    a.threadOpened({
      thread: 'T3',
      parent: 'D1.2',
      title: 'Check Paphos flights',
    }),
  ]

  test('a decision’s details list its options, each with its replies and children', () => {
    expect(details(fold(holiday), 'D1')).toEqual(
      block(
        true,
        'D1 Decision: Which holiday do we book?',
        '   Options:',
        '     ◇ D1.1 Greek village',
        '         #1 human: best beach of the lot, but 2h by bus',
        '     ◇ D1.2 Paphos',
        '         T3 Check Paphos flights ○',
      ),
    )
  })

  test('a dropped option is listed ✗ with the human’s reason', () => {
    const state = fold([
      a.goalOpened(),
      a.decisionOpened(),
      a.optionAdded(),
      a.optionAdded({ option: 'D1.2', title: 'Paphos' }),
      a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
    ])

    expect(details(state, 'D1')).toEqual(
      block(
        true,
        'D1 Decision: Which holiday do we book?',
        '   Options:',
        '     ✗ D1.1 Greek village · too far with the kids',
        '     ◇ D1.2 Paphos',
      ),
    )
  })

  test('an option’s details are a thread’s: its title, its decision, how it stands and its replies', () => {
    expect(details(fold(holiday), 'D1.1')).toEqual(
      block(
        true,
        'D1.1 Greek village',
        'under D1',
        'open',
        '#1 human: best beach of the lot, but 2h by bus',
      ),
    )
  })

  test('an option’s details list its children', () => {
    expect(details(fold(holiday), 'D1.2')).toEqual(
      block(
        true,
        'D1.2 Paphos',
        'under D1',
        'open',
        'children: T3 ○ Check Paphos flights',
      ),
    )
  })
})

describe('show lists in the pane’s sibling order, whatever the log order', () => {
  const moved = fold([
    a.goalOpened(),
    a.decisionOpened(),
    a.decisionOpened({ decision: 'D3', title: 'Which flights?' }),
    a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Direct' }),
    a.optionAdded(),
    a.decisionOpened({ decision: 'D4', parent: 'D1.1', title: 'Which bus?' }),
    a.threadOpened({ thread: 'T5', parent: 'D1.1', title: 'Bus times' }),
    a.nodeMoved({ node: 'D3.1', parent: 'D1', source: 'claude' }),
  ])

  test('a decision’s options are numeric, and what is under an option has threads before decisions', () => {
    expect(details(moved, 'D1')).toEqual(
      block(
        true,
        'D1 Decision: Which holiday do we book?',
        '   Options:',
        '     ◇ D1.1 Greek village',
        '         T5 Bus times ○',
        '         D4 Which bus? ◆',
        '     ◇ D3.1 Direct',
      ),
    )
  })

  test('an option’s children line has threads before decisions', () => {
    expect(details(moved, 'D1.1')).toEqual(
      block(
        true,
        'D1.1 Greek village',
        'under D1',
        'open',
        'children: T5 ○ Bus times, D4 ◆ Which bus?',
      ),
    )
  })
})

describe('a closed decision’s details', () => {
  const holiday = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
    a.threadOpened({
      thread: 'T6',
      parent: 'D1.3',
      title: 'Check Paphos flights',
    }),
    a.threadResolved({ thread: 'T6', outcome: 'direct, Thursday and Sunday' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
  ]

  test('a decided decision lists the pick, the words behind it and each option as it ended, in ID order', () => {
    expect(details(fold([...holiday, a.decisionMade()]), 'D1')).toEqual(
      block(
        false,
        'D1 Decision: Which holiday do we book?',
        '   Decision: D1.3 Paphos',
        '   because (chat): Paphos then, the 20 min transfer settles it',
        '   Options:',
        '     ✗ D1.1 Greek village · too far with the kids',
        '     · D1.2 Costa del Sol',
        '     ✓ D1.3 Paphos',
        '         T6 direct, Thursday and Sunday ✓',
      ),
    )
  })

  // The decision's own lines are not pinned here, only its options'.
  const optionLines = (events: Event[]) =>
    details(fold(events), 'D1').filter(line => /^ {5}\S/.test(line.text))

  test('a cancelled decision lists its open options cancelled with it, and one dropped before with its own reason', () => {
    const given = [...holiday, a.nodeCancelled({ node: 'D1' })]

    expect(optionLines(given)).toEqual(
      block(
        false,
        '     ✗ D1.1 Greek village · too far with the kids',
        '     ✗ D1.2 Costa del Sol · with D1',
        '     ✗ D1.3 Paphos · with D1',
      ),
    )
  })
})

describe('a cancelled decision’s details', () => {
  const cancelled = fold([
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded(),
    a.optionAdded({ option: 'D1.2', title: 'Costa del Sol' }),
    a.nodeCancelled({ node: 'D1.1', reason: 'too far with the kids' }),
    a.nodeCancelled({ node: 'D1', reason: "we're not going this year" }),
  ])

  test('say so and keep the human’s words, above its options', () => {
    expect(details(cancelled, 'D1')).toEqual(
      block(
        false,
        'D1 Decision: Which holiday do we book?',
        '   Cancelled',
        "   because (chat): we're not going this year",
        '   Options:',
        '     ✗ D1.1 Greek village · too far with the kids',
        '     ✗ D1.2 Costa del Sol · with D1',
      ),
    )
  })
})

describe('criteria in details', () => {
  const holiday = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.3', title: 'Paphos' }),
  ]
  const own = [
    a.criterionAdded(),
    a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
  ]

  test('a decision lists its own after the pick and before its options', () => {
    const given = [...holiday, ...own, a.decisionMade()]

    expect(details(fold(given), 'D1')).toEqual(
      block(
        false,
        'D1 Decision: Which holiday do we book?',
        '   Decision: D1.3 Paphos',
        '   because (chat): Paphos then, the 20 min transfer settles it',
        '   Criteria: C1 Europe · C2 sea ≥ 18°C',
        '   Options:',
        '     ✓ D1.3 Paphos',
      ),
    )
  })

  test('an own criterion says where it came up', () => {
    const given = [
      ...holiday,
      a.criterionAdded({
        criterion: 'C5',
        text: 'transfer ≤ 30 min',
        origin: 'D2',
      }),
    ]

    expect(details(fold(given), 'D1')).toEqual(
      block(
        true,
        'D1 Decision: Which holiday do we book?',
        '   Criteria: C5 transfer ≤ 30 min (from D2)',
        '   Options:',
        '     ◇ D1.3 Paphos',
      ),
    )
  })

  test('a cancelled decision still lists its own', () => {
    const given = [
      ...holiday,
      ...own.slice(0, 1),
      a.nodeCancelled({ node: 'D1' }),
    ]

    expect(details(fold(given), 'D1')).toEqual(
      block(
        false,
        'D1 Decision: Which holiday do we book?',
        '   Cancelled',
        '   because (chat): not going to Greece',
        '   Criteria: C1 Europe',
        '   Options:',
        '     ✗ D1.3 Paphos · with D1',
      ),
    )
  })

  const deep = [
    ...holiday,
    a.criterionAdded(),
    a.criterionAdded({ criterion: 'C2', text: 'sea ≥ 18°C' }),
    a.criterionAdded({
      criterion: 'C4',
      text: 'transfer ≤ 30 min',
      origin: 'D2',
    }),
    a.decisionOpened({
      decision: 'D3',
      parent: 'D1.3',
      title: 'Which flights?',
    }),
    a.optionAdded({ option: 'D3.1', decision: 'D3', title: 'Direct' }),
    a.decisionOpened({ decision: 'D7', parent: 'D3.1', title: 'Which seats?' }),
    a.criterionAdded({ criterion: 'C3', on: 'D7', text: 'quiet' }),
    a.threadOpened({ thread: 'T6', parent: 'D1.3', title: 'Check flights' }),
    a.decisionOpened({ decision: 'D4', title: 'Which hotel?' }),
  ]
  const inherited =
    'C1 Europe (D1) · C2 sea ≥ 18°C (D1) · C4 transfer ≤ 30 min (D1, from D2)'

  test('a decision with its own and inherited lists the inherited on a second line, aligned under the first', () => {
    expect(details(fold(deep), 'D7')).toEqual(
      block(
        true,
        'D7 Decision: Which seats?',
        '   Criteria: C3 quiet',
        `             ${inherited}`,
        '   Options:',
      ),
    )
  })

  test('a decision with only inherited lists them after Criteria:', () => {
    expect(details(fold(deep), 'D3')).toEqual(
      block(
        true,
        'D3 Decision: Which flights?',
        `   Criteria: ${inherited}`,
        '   Options:',
        '     ◇ D3.1 Direct',
        '         D7 Which seats? ◆',
      ),
    )
  })

  test('a decision with none has no Criteria line', () => {
    expect(
      details(fold(deep), 'D4').filter(line => line.text.includes('Criteria')),
    ).toEqual([])
  })

  test('a thread lists those in force right after its status', () => {
    expect(details(fold(deep), 'T6')).toEqual(
      block(
        true,
        'T6 Check flights',
        'under D1.3',
        'open',
        `Criteria in force: ${inherited}`,
      ),
    )
  })

  test('a resolved thread lists them after its outcome and reason, before its children', () => {
    const given = [
      ...deep,
      a.threadOpened({ thread: 'T8', parent: 'T6', title: 'Which airline?' }),
      a.threadResolved({ thread: 'T8', outcome: 'Aegean' }),
      a.threadResolved({ thread: 'T6', outcome: 'direct' }),
    ]

    expect(details(fold(given), 'T6')).toEqual(
      block(
        false,
        'T6 Check flights',
        'under D1.3',
        'resolved → direct',
        'that covers it',
        `Criteria in force: ${inherited}`,
        'children: T8 ✓ Aegean',
      ),
    )
  })

  test('an option lists those in force', () => {
    expect(details(fold(deep), 'D3.1')).toEqual(
      block(
        true,
        'D3.1 Direct',
        'under D3',
        'open',
        `Criteria in force: ${inherited}`,
        'children: D7 ◆ Which seats?',
      ),
    )
  })

  test('a node with none in force has no such line', () => {
    const given = [...holiday, a.threadOpened({ thread: 'T6' })]

    expect(
      details(fold(given), 'T6').filter(line => line.text.includes('Criteria')),
    ).toEqual([])
  })

  test('a criterion is one line, with where it sits', () => {
    expect(details(fold(deep), 'C1')).toEqual(block(true, 'C1 Europe (on D1)'))
  })

  test('a criterion says where it came up', () => {
    expect(details(fold(deep), 'C4')).toEqual(
      block(true, 'C4 transfer ≤ 30 min (on D1, from D2)'),
    )
  })

  test('a criterion of a closed decision is dimmed', () => {
    const given = [...holiday, ...own.slice(0, 1), a.decisionMade()]

    expect(details(fold(given), 'C1')).toEqual(
      block(false, 'C1 Europe (on D1)'),
    )
  })

  test('an ID that names no criterion has no details', () => {
    expect(details(fold(deep), 'C9')).toEqual([])
  })
})
