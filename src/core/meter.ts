import { config } from './config.ts'

// The context meter (zg-n27): once the session's tokens pass nudge_at or
// push_at, a line tells Claude to suggest closing or to press the human to
// close. Tokens are compared raw and shown floored to thousands. The config
// is the raw text of .zg/config.json, undefined when the file is absent.

export const meter = (
  tokens: number | undefined,
  configText: string | undefined,
): string | undefined => {
  if (tokens === undefined) return undefined
  const { nudgeAt, pushAt } = config(configText)
  const shown = Math.floor(tokens / 1000)
  if (tokens >= pushAt) {
    return `context ${shown}k, past push_at ${Math.floor(pushAt / 1000)}k: press the human to close`
  }
  if (tokens >= nudgeAt) {
    return `context ${shown}k, past nudge_at ${Math.floor(nudgeAt / 1000)}k: suggest closing`
  }

  return undefined
}
