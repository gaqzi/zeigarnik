// The context meter (zg-n27): once the session's tokens pass nudge_at or
// push_at, a line tells Claude to suggest closing or to press the human to
// close. Tokens are compared raw and shown floored to thousands. The config
// is the raw text of .zg/config.json, undefined when the file is absent.

const DEFAULT_NUDGE_AT = 100_000
const DEFAULT_PUSH_AT = 150_000

const parse = (config: string | undefined): Record<string, unknown> => {
  if (config === undefined) return {}
  try {
    const parsed = JSON.parse(config) as Record<string, unknown> | null

    return parsed ?? {}
  } catch {
    return {}
  }
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' ? value : fallback

const thresholds = (config: string | undefined) => {
  const keys = parse(config)
  const nudgeAt = numberOr(keys.nudge_at, DEFAULT_NUDGE_AT)
  const pushAt = numberOr(keys.push_at, DEFAULT_PUSH_AT)

  return nudgeAt < pushAt
    ? { nudgeAt, pushAt }
    : { nudgeAt: DEFAULT_NUDGE_AT, pushAt: DEFAULT_PUSH_AT }
}

export const meter = (
  tokens: number | undefined,
  config: string | undefined,
): string | undefined => {
  if (tokens === undefined) return undefined
  const { nudgeAt, pushAt } = thresholds(config)
  const shown = Math.floor(tokens / 1000)
  if (tokens >= pushAt) {
    return `context ${shown}k, past push_at ${Math.floor(pushAt / 1000)}k: press the human to close`
  }
  if (tokens >= nudgeAt) {
    return `context ${shown}k, past nudge_at ${Math.floor(nudgeAt / 1000)}k: suggest closing`
  }

  return undefined
}
