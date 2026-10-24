import type { State } from './evolve.ts'

// The line that goes with every prompt (zg-n27): what is open, by ID and a
// short title, so Claude knows what to ask about without calling show. It is
// about 300 tokens plus 15 an item however long the titles are. Titles are
// flattened to one line.

const MAX_TEXT = 48

const cut = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim()

  return line.length <= MAX_TEXT ? line : `${line.slice(0, MAX_TEXT - 1)}…`
}

export const turnIndex = (state: State): string | undefined => {
  if (!state.goals.some(goal => goal.status === 'open')) return undefined
  const threads = state.nodes
    .filter(node => node.status === 'open')
    .map(node => `${node.id} ${cut(node.title)}`)
  const actions = state.actions
    .filter(action => action.status === 'open')
    .map(action => `${action.id} ${cut(action.text)}`)
  const sides = [threads, actions]
    .filter(side => side.length > 0)
    .map(side => side.join(' · '))
  if (sides.length === 0) return undefined

  return `zg open: ${sides.join(' | ')}`
}
