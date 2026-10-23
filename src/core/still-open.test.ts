import { describe, expect, test } from 'claude-code/testing'

import { stillOpenUnder } from './still-open.ts'

describe('the children still open under a parent', () => {
  const sentences: {
    name: string
    children: { id: string; label: string }[]
    sentence: string
  }[] = [
    {
      name: 'one child is still open',
      children: [{ id: 'T2', label: 'A' }],
      sentence: 'T2 A is still open under T1.',
    },
    {
      name: 'two children are still open',
      children: [
        { id: 'T2', label: 'A' },
        { id: 'T3', label: 'B' },
      ],
      sentence: 'T2 A and T3 B are still open under T1.',
    },
    {
      name: 'three children are still open',
      children: [
        { id: 'T2', label: 'A' },
        { id: 'T3', label: 'B' },
        { id: 'T4', label: 'C' },
      ],
      sentence: 'T2 A, T3 B and T4 C are still open under T1.',
    },
  ]
  for (const { name, children, sentence } of sentences) {
    test(`the sentence reads right when ${name}`, () => {
      expect(stillOpenUnder(children, 'T1')).toBe(sentence)
    })
  }
})
