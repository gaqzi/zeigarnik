// Item IDs, from the README's Concepts: each kind of item has a letter and
// its own numbering, local to the session.

export type Kind = 'T' | 'D' | 'A' | 'C'

export const nextId = (kind: Kind, taken: readonly string[]): string => {
  const numbers = taken
    .filter(id => id.startsWith(kind))
    .map(id => Number(id.slice(kind.length)))

  return `${kind}${Math.max(0, ...numbers) + 1}`
}
