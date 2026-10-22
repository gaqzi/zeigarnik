// The session's title at goal open: the goal's first line, after its origin
// when there is one, so the session is easy to find later.

const MAX_TITLE = 60

export const title = (text: string, origin?: string): string => {
  const first = text.trim().split('\n')[0]?.trim() ?? ''
  const whole = origin === undefined ? first : `${origin} ${first}`

  return whole.length <= MAX_TITLE
    ? whole
    : `${whole.slice(0, MAX_TITLE - 1).trimEnd()}…`
}
