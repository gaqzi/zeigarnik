import type { State } from './evolve.ts'

// zg-bam.15: typing T at the start of a line in the reply box offers the open
// threads the draft does not name yet, each as the prefix of an answer.

export type ReplyRow = { text: string; label: string; description: string }

const THREAD_TOKEN = /^t\d*$/i
const NAMED = /\bt\d+\b/gi

const namedOutsideToken = (
  text: string,
  cursor: number,
  token: string,
): string[] =>
  (text.slice(0, cursor - token.length) + text.slice(cursor))
    .match(NAMED)
    ?.map(id => id.toUpperCase()) ?? []

export const replyRows = (
  state: State,
  text: string,
  cursor: number,
  token: string,
): ReplyRow[] => {
  const startsLine = text.slice(0, cursor - token.length).match(/(^|\n)$/)
  if (!THREAD_TOKEN.test(token) || startsLine === null) return []
  const named = namedOutsideToken(text, cursor, token)
  const wanted = token.toUpperCase()

  return state.nodes
    .filter(
      node =>
        node.kind === 'thread' &&
        node.status === 'open' &&
        node.id.startsWith(wanted) &&
        !named.includes(node.id),
    )
    .map(node => ({
      text: `${node.id}: `,
      label: node.id,
      description: node.title,
    }))
}
