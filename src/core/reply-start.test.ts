import { describe, expect, test } from 'claude-code/testing'

import { replyStart } from './reply-start.ts'

// What pressing an ID in the pane's waiting line appends to the reply box to
// start an answer to a thread: its ID as the prefix of a line, unless a line
// of the draft already starts with it.

describe('replyStart', () => {
  const cases: { name: string; draft: string; id: string; start: string }[] = [
    { name: 'the box is empty', draft: '', id: 'T5', start: 'T5: ' },
    {
      name: 'the draft answers another thread',
      draft: 'T3: coast road only',
      id: 'T5',
      start: '\nT5: ',
    },
    {
      name: 'the draft already starts the answer',
      draft: 'T5: ',
      id: 'T5',
      start: '',
    },
    {
      name: 'the draft has its line earlier',
      draft: 'T5: fine\nT3: ok',
      id: 'T5',
      start: '',
    },
    {
      name: 'the draft ends with a newline',
      draft: 'T3: ok\n',
      id: 'T5',
      start: 'T5: ',
    },
    {
      name: 'the draft only mentions it mid-line',
      draft: 'ok, but t5 can wait',
      id: 'T5',
      start: '\nT5: ',
    },
    {
      name: 'the draft mentions it after another line start',
      draft: 'T3: same as t5',
      id: 'T5',
      start: '\nT5: ',
    },
    {
      name: 'the draft starts a line with it in lower case',
      draft: 't3: ok\nt5: fine',
      id: 'T5',
      start: '',
    },
    {
      name: 'the draft names only T50',
      draft: 'T50: fine',
      id: 'T5',
      start: '\nT5: ',
    },
    {
      name: 'the draft names only an option of it',
      draft: 'T5.1 is better',
      id: 'T5',
      start: '\nT5: ',
    },
  ]
  for (const { name, draft, id, start } of cases) {
    test(`appends ${JSON.stringify(start)} when ${name}`, () => {
      expect(replyStart(draft, id)).toBe(start)
    })
  }
})
