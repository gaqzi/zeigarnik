// The sentence a "children close first" refusal lists the open children in:
// who is still open under which parent.

import { joinList } from './join-list.ts'

export type Child = { id: string; label: string }

export const stillOpenUnder = (
  children: readonly Child[],
  parent: string,
): string => {
  const list = joinList(
    children.map(child => `${child.id} ${child.label}`),
    'and',
  )
  const verb = children.length === 1 ? 'is' : 'are'

  return `${list} ${verb} still open under ${parent}.`
}
