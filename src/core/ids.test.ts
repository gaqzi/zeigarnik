import { describe, expect, test } from 'claude-code/testing'

import { type Kind, nextId } from './ids.ts'

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
  ]
  for (const { name, kind, taken, id } of cases) {
    test(name, () => {
      expect(nextId(kind, taken)).toBe(id)
    })
  }
})
