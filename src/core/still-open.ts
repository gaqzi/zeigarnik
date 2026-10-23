// The sentence a "children close first" refusal lists the open children in:
// who is still open under which parent.

export type Child = { id: string; label: string }

export const stillOpenUnder = (
  children: readonly Child[],
  parent: string,
): string => {
  const names = children.map(child => `${child.id} ${child.label}`)
  const last = names.pop()
  const list = names.length === 0 ? last : `${names.join(', ')} and ${last}`
  const verb = children.length === 1 ? 'is' : 'are'

  return `${list} ${verb} still open under ${parent}.`
}
