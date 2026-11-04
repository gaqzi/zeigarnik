// .zg/config.json (zg-bam.6.11), parsed and checked. The text is the raw
// file, undefined when the file is absent. A bad part takes its default and
// is named in one warning line that gives the reason and the fix.

export type Config = {
  nudgeAt: number
  pushAt: number
  warning: string | undefined
}

const DEFAULT_NUDGE_AT = 100_000
const DEFAULT_PUSH_AT = 150_000
const KNOWN_KEYS = ['nudge_at', 'push_at']

const defaults = (warning: string | undefined): Config => ({
  nudgeAt: DEFAULT_NUDGE_AT,
  pushAt: DEFAULT_PUSH_AT,
  warning,
})

const isTokens = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const badValue = (key: string, value: unknown, fallback: number) =>
  `${key} is ${JSON.stringify(value)}, not a whole number of tokens above 0, so zg uses its default ${fallback}. Fix it, or remove ${key} to use the default.`

export const config = (text: string | undefined): Config => {
  if (text === undefined) return defaults(undefined)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return defaults(
      "zg: .zg/config.json isn't valid JSON, so zg uses its defaults. Fix it, or delete the file to use the defaults.",
    )
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return defaults(
      "zg: .zg/config.json isn't a JSON object, so zg uses its defaults. Fix it, or delete the file to use the defaults.",
    )
  }

  const keys = parsed as Record<string, unknown>
  const sentences: string[] = []
  let nudgeAt = DEFAULT_NUDGE_AT
  let pushAt = DEFAULT_PUSH_AT
  if (keys.nudge_at !== undefined) {
    if (isTokens(keys.nudge_at)) nudgeAt = keys.nudge_at
    else sentences.push(badValue('nudge_at', keys.nudge_at, DEFAULT_NUDGE_AT))
  }
  if (keys.push_at !== undefined) {
    if (isTokens(keys.push_at)) pushAt = keys.push_at
    else sentences.push(badValue('push_at', keys.push_at, DEFAULT_PUSH_AT))
  }
  if (nudgeAt >= pushAt) {
    sentences.push(
      `nudge_at ${nudgeAt} is not below push_at ${pushAt}, so zg uses its defaults ${DEFAULT_NUDGE_AT} and ${DEFAULT_PUSH_AT}. Fix them, or remove both to use the defaults.`,
    )
    nudgeAt = DEFAULT_NUDGE_AT
    pushAt = DEFAULT_PUSH_AT
  }
  for (const key of Object.keys(keys)) {
    if (KNOWN_KEYS.includes(key)) continue
    sentences.push(
      `${shownKey(key)} isn't a setting zg knows (nudge_at, push_at), so zg ignores it. Fix its name, or remove it.`,
    )
  }

  return {
    nudgeAt,
    pushAt,
    warning:
      sentences.length === 0
        ? undefined
        : `zg: .zg/config.json: ${sentences.join(' ')}`,
  }
}

const MAX_KEY_LENGTH = 40

const shownKey = (key: string): string => {
  const chars = Array.from(key.replace(/[\p{Cc}\p{Cf}]/gu, ''))

  return chars.length > MAX_KEY_LENGTH
    ? `${chars.slice(0, MAX_KEY_LENGTH).join('')}…`
    : chars.join('')
}

export const unreadableConfig = (error: string): Config => {
  const denied = error.includes('EACCES')
  const reason = denied ? 'permission denied' : error
  const fix = denied ? 'Fix its permissions' : 'Fix it'

  return defaults(
    `zg: .zg/config.json can't be read (${reason}), so zg uses its defaults. ${fix}, or delete it to use the defaults.`,
  )
}
