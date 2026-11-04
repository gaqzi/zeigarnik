import { describe, expect, test } from 'claude-code/testing'

import { meter } from './meter.ts'

// zg-bam.6.9: the context meter. Tokens are compared raw against the
// thresholds and shown floored to thousands; config is the raw text of
// .zg/config.json, undefined when the file is absent.

const nudge = (shown: number, at: number) =>
  `context ${shown}k, past nudge_at ${at}k: suggest closing`

const push = (shown: number, at: number) =>
  `context ${shown}k, past push_at ${at}k: press the human to close`

test('says nothing below the default nudge_at when there is no config', () => {
  expect(meter(99_999, undefined)).toBeUndefined()
})

describe('the meter line', () => {
  const cases: {
    name: string
    tokens: number | undefined
    config: string | undefined
    line: string | undefined
  }[] = [
    {
      name: 'suggests closing at the default nudge_at',
      tokens: 100_000,
      config: undefined,
      line: nudge(100, 100),
    },
    {
      name: 'still suggests closing just below the default push_at',
      tokens: 149_999,
      config: undefined,
      line: nudge(149, 100),
    },
    {
      name: 'presses the human to close at the default push_at',
      tokens: 150_000,
      config: undefined,
      line: push(150, 150),
    },
    {
      name: 'floors the shown tokens to thousands',
      tokens: 100_999,
      config: undefined,
      line: nudge(100, 100),
    },
    {
      name: 'uses a nudge_at from the config',
      tokens: 50_000,
      config: '{"nudge_at":50000}',
      line: nudge(50, 50),
    },
    {
      name: 'uses a push_at from the config',
      tokens: 120_000,
      config: '{"push_at":120000}',
      line: push(120, 120),
    },
    {
      name: 'falls back to both defaults when nudge_at is not below push_at',
      tokens: 150_000,
      config: '{"nudge_at":200000}',
      line: push(150, 150),
    },
    {
      name: 'falls back to both defaults when nudge_at equals push_at',
      tokens: 120_000,
      config: '{"nudge_at":120000,"push_at":120000}',
      line: nudge(120, 100),
    },
    {
      name: 'keeps the default push_at when only a nudge_at above it is set',
      tokens: 100_000,
      config: '{"nudge_at":200000}',
      line: nudge(100, 100),
    },
    {
      name: 'says nothing without a token count',
      tokens: undefined,
      config: undefined,
      line: undefined,
    },
    {
      name: 'gives the defaults, never a thrown error, for a config that cannot be parsed',
      tokens: 100_000,
      config: '{"nudge_at":',
      line: nudge(100, 100),
    },
  ]
  for (const { name, tokens, config, line } of cases) {
    test(name, () => {
      expect(meter(tokens, config)).toBe(line)
    })
  }
})
