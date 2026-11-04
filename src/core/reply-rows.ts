import type { State } from './evolve.ts'
import { currentText } from './in-force.ts'
import type { Kind } from './ids.ts'
import { waitingOnYou } from './waiting-on-you.ts'

// zg-bam.15, zg-bam.16: typing T, D, A or C at the start of a line in the reply
// box offers what that letter names, each as the prefix of an answer: the open
// threads, and the decisions, actions and criteria of every status.

export type ReplyRow = { text: string; label: string; description: string }

export const REPLY_TOKEN = /^[TtDdAaCc]\d*$/
// An option ID such as D1.1 does not name its decision.
const NAMED = /\b[tdac]\d+\b(?!\.\d)/gi

type Candidate = { id: string; description: string }

const candidates = (state: State, kind: Kind): Candidate[] => {
  switch (kind) {
    case 'T': {
      const waiting = waitingOnYou(state)
      return state.nodes
        .filter(node => node.kind === 'thread' && node.status === 'open')
        .map(node => ({
          id: node.id,
          description: waiting.includes(node.id)
            ? `waiting on you · ${node.title}`
            : node.title,
        }))
    }
    case 'D':
      return state.nodes
        .filter(node => node.kind === 'decision')
        .map(node => ({ id: node.id, description: node.title }))
    case 'A':
      return state.actions.map(action => ({
        id: action.id,
        description: action.text,
      }))
    case 'C':
      return state.criteria.map(criterion => ({
        id: criterion.id,
        description: currentText(criterion),
      }))
  }
}

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
  if (!REPLY_TOKEN.test(token) || startsLine === null) return []
  const named = namedOutsideToken(text, cursor, token)
  const wanted = token.toUpperCase()

  return candidates(state, wanted.charAt(0) as Kind)
    .filter(item => item.id.startsWith(wanted) && !named.includes(item.id))
    .map(item => ({
      text: `${item.id}: `,
      label: item.id,
      description: item.description,
    }))
}
