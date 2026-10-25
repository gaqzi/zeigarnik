import { describe, expect, test } from 'claude-code/testing'

import { type Kind, nextId, nextOptionId } from './ids.ts'

describe('nextId', () => {
  test('the first item of a kind is number 1', () => {
    expect(nextId('T', [])).toBe('T1')
  })

  const cases: { name: string; kind: Kind; taken: string[]; id: string }[] = [
    {
      name: 'follows the highest taken',
      kind: 'T',
      taken: ['T1', 'T2'],
      id: 'T3',
    },
    { name: 'never reuses a gap', kind: 'T', taken: ['T1', 'T3'], id: 'T4' },
    {
      name: 'counts each kind on its own',
      kind: 'D',
      taken: ['T1', 'T2', 'D1'],
      id: 'D2',
    },
    {
      name: 'counts a decision, not its options',
      kind: 'D',
      taken: ['D1', 'D1.1'],
      id: 'D2',
    },
    {
      name: 'counts decisions numerically, whatever their options',
      kind: 'D',
      taken: ['D1', 'D1.10', 'D2', 'D1.2'],
      id: 'D3',
    },
  ]
  for (const { name, kind, taken, id } of cases) {
    test(name, () => {
      expect(nextId(kind, taken)).toBe(id)
    })
  }
})

// An option is numbered under its decision. Every option ever added is taken,
// dropped or moved ones included: IDs are names, and a number is never reused.
describe('nextOptionId', () => {
  test('the first option of a decision is number 1 under it', () => {
    expect(nextOptionId('D1', ['D1'])).toBe('D1.1')
  })

  const cases: {
    name: string
    decision: string
    taken: string[]
    id: string
  }[] = [
    {
      name: 'follows the highest option taken',
      decision: 'D1',
      taken: ['D1', 'D1.1'],
      id: 'D1.2',
    },
    {
      name: 'never reuses a gap, as when an option was dropped',
      decision: 'D1',
      taken: ['D1', 'D1.1', 'D1.3'],
      id: 'D1.4',
    },
    {
      name: 'compares numbers, so D1.10 follows D1.9',
      decision: 'D1',
      taken: ['D1', 'D1.9', 'D1.10'],
      id: 'D1.11',
    },
    {
      name: 'counts the options of its own decision only',
      decision: 'D2',
      taken: ['D1', 'D1.1', 'D1.2', 'D2', 'D2.1'],
      id: 'D2.2',
    },
    {
      name: 'does not take the options of D11 for those of D1',
      decision: 'D1',
      taken: ['D1', 'D11', 'D11.4'],
      id: 'D1.1',
    },
  ]
  for (const { name, decision, taken, id } of cases) {
    test(name, () => {
      expect(nextOptionId(decision, taken)).toBe(id)
    })
  }
})
