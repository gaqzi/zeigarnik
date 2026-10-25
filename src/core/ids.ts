// Item IDs, from the README's Concepts: each kind of item has a letter and
// its own numbering, local to the session. An option is numbered under its
// decision (D1.2), so a plain ID is one without a dot.

export type Kind = 'T' | 'D' | 'A' | 'C'

const highest = (numbers: readonly number[]) => Math.max(0, ...numbers)

export const nextId = (kind: Kind, taken: readonly string[]): string => {
  const numbers = taken
    .filter(id => id.startsWith(kind) && !id.includes('.'))
    .map(id => Number(id.slice(kind.length)))

  return `${kind}${highest(numbers) + 1}`
}

// Every option ever added is taken, dropped or moved ones included.
export const nextOptionId = (
  decision: string,
  taken: readonly string[],
): string => {
  const prefix = `${decision}.`
  const numbers = taken
    .filter(id => id.startsWith(prefix))
    .map(id => Number(id.slice(prefix.length)))

  return `${prefix}${highest(numbers) + 1}`
}
