import { describe, expect, test } from 'claude-code/testing'

import { config, unreadableConfig } from './config.ts'
import type { Config } from './config.ts'

// zg-bam.6.11: .zg/config.json, parsed and checked. The text is the raw
// file, undefined when the file is absent. A bad part takes its default and
// is named in one warning line; the line gives the reason and the fix.

const settings = (overrides: Partial<Config> = {}): Config => ({
  nudgeAt: 100_000,
  pushAt: 150_000,
  warning: undefined,
  ...overrides,
})

const notJson =
  "zg: .zg/config.json isn't valid JSON, so zg uses its defaults. Fix it, or delete the file to use the defaults."
const notObject =
  "zg: .zg/config.json isn't a JSON object, so zg uses its defaults. Fix it, or delete the file to use the defaults."

const badNudge = (shown: string) =>
  `nudge_at is ${shown}, not a whole number of tokens above 0, so zg uses its default 100000. Fix it, or remove nudge_at to use the default.`
const badPush = (shown: string) =>
  `push_at is ${shown}, not a whole number of tokens above 0, so zg uses its default 150000. Fix it, or remove push_at to use the default.`
const unknown = (key: string) =>
  `${key} isn't a setting zg knows (nudge_at, push_at), so zg ignores it. Fix its name, or remove it.`
const notBelow = (nudgeAt: number, pushAt: number) =>
  `nudge_at ${nudgeAt} is not below push_at ${pushAt}, so zg uses its defaults 100000 and 150000. Fix them, or remove both to use the defaults.`
const line = (...sentences: string[]) =>
  `zg: .zg/config.json: ${sentences.join(' ')}`

test('gives the defaults and no warning when the file is absent', () => {
  expect(config(undefined)).toEqual(settings())
})

describe('a file zg reads', () => {
  const cases: { name: string; text: string; expected: Config }[] = [
    {
      name: 'uses a nudge_at below the default push_at without a warning',
      text: '{"nudge_at": 50000}',
      expected: settings({ nudgeAt: 50_000 }),
    },
    {
      name: 'uses the defaults without a warning for an empty object',
      text: '{}',
      expected: settings(),
    },
    {
      name: 'warns that the file is not valid JSON',
      text: '{"nudge_at": 50000',
      expected: settings({ warning: notJson }),
    },
    {
      name: 'warns that an array is not a JSON object',
      text: '[100000]',
      expected: settings({ warning: notObject }),
    },
    {
      name: 'warns that null is not a JSON object',
      text: 'null',
      expected: settings({ warning: notObject }),
    },
    {
      name: 'warns that a scalar is not a JSON object',
      text: '5',
      expected: settings({ warning: notObject }),
    },
    {
      name: 'defaults a nudge_at that is a string',
      text: '{"nudge_at": "100k"}',
      expected: settings({ warning: line(badNudge('"100k"')) }),
    },
    {
      name: 'defaults a nudge_at of 0 and keeps a valid push_at',
      text: '{"nudge_at": 0, "push_at": 120000}',
      expected: settings({ pushAt: 120_000, warning: line(badNudge('0')) }),
    },
    {
      name: 'defaults a push_at that is not a whole number',
      text: '{"push_at": 150000.5}',
      expected: settings({ warning: line(badPush('150000.5')) }),
    },
    {
      name: 'ignores an unknown key that looks like a misspelt nudge_at',
      text: '{"nudge": 50000}',
      expected: settings({ warning: line(unknown('nudge')) }),
    },
    {
      name: 'ignores an unknown key',
      text: '{"sink": "bd"}',
      expected: settings({ warning: line(unknown('sink')) }),
    },
    {
      name: 'accepts a nudge_at just below the default push_at',
      text: '{"nudge_at": 149999}',
      expected: settings({ nudgeAt: 149_999 }),
    },
    {
      name: 'defaults both when nudge_at equals the default push_at',
      text: '{"nudge_at": 150000}',
      expected: settings({ warning: line(notBelow(150_000, 150_000)) }),
    },
    {
      name: 'defaults both when nudge_at is above push_at',
      text: '{"nudge_at": 200000, "push_at": 120000}',
      expected: settings({ warning: line(notBelow(200_000, 120_000)) }),
    },
    {
      name: 'compares nudge_at with push_at after a bad nudge_at took its default',
      text: '{"nudge_at": "x", "push_at": 50000}',
      expected: settings({
        warning: line(badNudge('"x"'), notBelow(100_000, 50_000)),
      }),
    },
    {
      name: 'compares nudge_at with push_at after a bad push_at took its default',
      text: '{"nudge_at": 160000, "push_at": "x"}',
      expected: settings({
        warning: line(badPush('"x"'), notBelow(160_000, 150_000)),
      }),
    },
    {
      name: 'gives one line with nudge_at before push_at whatever the file order',
      text: '{"push_at": "y", "nudge_at": "x"}',
      expected: settings({ warning: line(badNudge('"x"'), badPush('"y"')) }),
    },
    {
      name: 'puts the not-below sentence after the nudge_at and push_at ones and before unknown keys',
      text: '{"sink": "bd", "nudge_at": 200000, "push_at": 120000}',
      expected: settings({
        warning: line(notBelow(200_000, 120_000), unknown('sink')),
      }),
    },
    {
      name: 'lists unknown keys in the order of the file',
      text: '{"zeta": 1, "nudge_at": 0, "alpha": 2}',
      expected: settings({
        warning: line(badNudge('0'), unknown('zeta'), unknown('alpha')),
      }),
    },
  ]
  for (const { name, text, expected } of cases) {
    test(name, () => {
      expect(config(text)).toEqual(expected)
    })
  }
})

describe('a file zg cannot read', () => {
  const cases: {
    name: string
    error: string
    reason: string
    fix: string
  }[] = [
    {
      name: 'gives permission denied as the reason for EACCES and asks for its permissions',
      error: 'EACCES: /x/.zg/config.json',
      reason: 'permission denied',
      fix: 'Fix its permissions, or delete it to use the defaults.',
    },
    {
      name: 'gives the message as the reason for EISDIR and a neutral fix',
      error: 'EISDIR: /x/.zg/config.json',
      reason: 'EISDIR: /x/.zg/config.json',
      fix: 'Fix it, or delete it to use the defaults.',
    },
    {
      name: 'gives the message as the reason for EIO and a neutral fix',
      error: 'EIO: /x/.zg/config.json',
      reason: 'EIO: /x/.zg/config.json',
      fix: 'Fix it, or delete it to use the defaults.',
    },
  ]
  for (const { name, error, reason, fix } of cases) {
    test(`${name}, with the defaults`, () => {
      expect(unreadableConfig(error)).toEqual(
        settings({
          warning: `zg: .zg/config.json can't be read (${reason}), so zg uses its defaults. ${fix}`,
        }),
      )
    })
  }
})

describe('an unknown key whose name is not safe to show', () => {
  // The key text is raw JSON, so a \\u escape becomes a real character.
  const cases: { name: string; key: string; shown: string }[] = [
    {
      name: 'strips a terminal escape',
      key: String.raw`a\u001b[31mb`,
      shown: 'a[31mb',
    },
    { name: 'strips a newline', key: String.raw`a\nb`, shown: 'ab' },
    { name: 'strips a C1 control', key: String.raw`a\u009bb`, shown: 'ab' },
    { name: 'strips DEL', key: String.raw`a\u007fb`, shown: 'ab' },
    {
      name: 'strips a bidi override',
      key: String.raw`a\u202eb`,
      shown: 'ab',
    },
    {
      name: 'caps a key longer than 40 characters with an ellipsis',
      key: 'k'.repeat(41),
      shown: `${'k'.repeat(40)}…`,
    },
    {
      name: 'keeps a key of exactly 40 characters whole',
      key: 'k'.repeat(40),
      shown: 'k'.repeat(40),
    },
    {
      name: 'strips first, then caps',
      key: `${'k'.repeat(39)}${String.raw`\u001b`}kk`,
      shown: `${'k'.repeat(40)}…`,
    },
  ]
  for (const { name, key, shown } of cases) {
    test(`${name} before it reaches the warning`, () => {
      expect(config(`{"${key}": 1}`)).toEqual(
        settings({ warning: line(unknown(shown)) }),
      )
    })
  }
})
