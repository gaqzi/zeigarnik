import { describe, expect, test } from 'claude-code/testing'

import { title } from './title.ts'

describe("a session's title", () => {
  const cases: {
    name: string
    text: string
    origin?: string
    title: string
  }[] = [
    {
      name: 'is the goal when it is short',
      text: 'Pick a holiday',
      title: 'Pick a holiday',
    },
    {
      name: 'leads with the origin when there is one',
      text: 'Slice 1',
      origin: 'zg-bam.2',
      title: 'zg-bam.2 Slice 1',
    },
    {
      name: 'is only the first line',
      text: '  Pick a holiday\nFamily wants: Europe',
      title: 'Pick a holiday',
    },
    {
      name: 'is cut to 60 characters',
      text: 'Pick our end-of-May beach holiday somewhere warm, sunny and with good bars',
      title: 'Pick our end-of-May beach holiday somewhere warm, sunny and…',
    },
  ]
  for (const { name, text, origin, title: expected } of cases) {
    test(name, () => {
      expect(title(text, origin)).toBe(expected)
    })
  }
})
