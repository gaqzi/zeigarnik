import { describe, expect, test } from 'claude-code/testing'

import { a } from './a.ts'
import type { Event } from './events.ts'
import { recap } from './recap.ts'

// The session of the story's background: goal G and thread T4 open under it,
// with a decision, an option, an action and a criterion beside them.
const cyprus: Event[] = [
  a.goalOpened({ text: 'Pick our end-of-May beach holiday' }),
  a.threadOpened({ thread: 'T4', title: 'Places in Cyprus' }),
  a.decisionOpened(),
  a.optionAdded({ option: 'D1.2', title: 'Cyprus' }),
  a.actionAdded(),
  a.criterionAdded({ criterion: 'C1', on: 'D1' }),
]

test('a prompt that is only a node’s ID is answered with a recap of that node', () => {
  expect(recap(cyprus, 'T4')).toBe(
    'Recap T4\nNothing has changed on T4 since it opened.\nT4 Places in Cyprus\nunder G\nopen',
  )
})

describe('which prompts ask for a recap', () => {
  const cases = [
    { name: 'the ID alone', prompt: 'T4', recap: 'Recap T4' },
    {
      name: 'the ID in lower case between spaces',
      prompt: ' t4 ',
      recap: 'Recap T4',
    },
    { name: 'the goal as G', prompt: 'G', recap: 'Recap G' },
    { name: 'a decision’s ID', prompt: 'D1', recap: 'Recap D1' },
    { name: 'an option’s ID', prompt: 'D1.2', recap: 'Recap D1.2' },
    { name: 'an action’s ID, out of scope', prompt: 'A1', recap: undefined },
    { name: 'a criterion’s ID, out of scope', prompt: 'C1', recap: undefined },
    { name: 'the ID with a question mark', prompt: 'T4?', recap: undefined },
    {
      name: 'the ID with more words after it',
      prompt: 'T4: ok',
      recap: undefined,
    },
    { name: 'the ID after other words', prompt: 'see T4', recap: undefined },
    { name: 'an empty prompt', prompt: '', recap: undefined },
  ]

  for (const { name, prompt, recap: expected } of cases) {
    test(name, () => {
      expect(recap(cyprus, prompt)?.split('\n')[0]).toBe(expected)
    })
  }
})

test('the recap body is what show answers, with a thread’s replies, children and criteria', () => {
  const rich: Event[] = [
    a.goalOpened(),
    a.decisionOpened(),
    a.optionAdded({ option: 'D1.1' }),
    a.threadOpened({
      thread: 'T4',
      parent: 'D1.1',
      title: 'Places in Cyprus',
    }),
    a.threadOpened({ thread: 'T5', parent: 'T4', title: 'Which coast?' }),
    a.nodeReplied({
      node: 'T4',
      author: 'claude',
      text: 'Paphos has the beaches',
    }),
    a.criterionAdded({ criterion: 'C1', on: 'D1', text: 'Direct flight' }),
  ]

  expect(recap(rich, 'T4')).toBe(
    'Recap T4\nSince T4 opened: C1 Direct flight added\nT4 Places in Cyprus\nunder D1.1\nopen\nCriteria in force: C1 Direct flight (D1)\nchildren: ○ T5 Which coast?\n#1 claude: Paphos has the beaches',
  )
})

test('the recap of the goal is the full view of the session', () => {
  const session: Event[] = [
    a.goalOpened({ text: 'Pick our end-of-May beach holiday' }),
    a.threadOpened({ thread: 'T4', title: 'Places in Cyprus' }),
  ]

  expect(recap(session, 'G')).toBe(
    'Recap G\n○ G Pick our end-of-May beach holiday\n1 open · 0 closed\n  ○ T4 Places in Cyprus',
  )
})

test('an unknown ID is answered with no recap line', () => {
  expect(recap(cyprus, 'T99')).toBe('There is no item T99.')
})

describe('G is the goal whose ID is G, and only while it is open', () => {
  const second: Event[] = [
    a.goalOpened(),
    a.goalAchieved(),
    a.goalOpened({ goal: 'G2', text: 'Pick a winter break' }),
  ]

  test('G is unknown when that goal is closed, though G2 is open', () => {
    expect(recap(second, 'G')).toBe('There is no item G.')
  })

  test('G2 alone is not a recap request', () => {
    expect(recap(second, 'G2')).toBe(undefined)
  })

  test('G is unknown once the only goal is closed', () => {
    const closed = [a.goalOpened(), a.goalCancelled()]

    expect(recap(closed, 'G')).toBe('There is no item G.')
  })
})

test('the since line is the second line of a recap, after the header', () => {
  const wrote: Event[] = [
    ...cyprus,
    a.nodeReplied({ node: 'T4', author: 'human', text: 'which coast?' }),
    a.threadOpened({ thread: 'T5', parent: 'T4', title: 'Which coast?' }),
    a.threadResolved({ thread: 'T5', outcome: 'Paphos' }),
  ]

  expect(recap(wrote, 'T4')?.split('\n').slice(0, 3)).toEqual([
    'Recap T4',
    'Since you last wrote on T4: T5 resolved → Paphos',
    'T4 Places in Cyprus',
  ])
})
