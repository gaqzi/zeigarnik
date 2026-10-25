// A list as a phrase: "a", "a and b", "a, b and c"; the conjunction is
// "and" or "or".

export const joinList = (
  items: readonly string[],
  conjunction: 'and' | 'or',
): string => {
  const last = items.at(-1) ?? ''

  return items.length <= 1
    ? last
    : `${items.slice(0, -1).join(', ')} ${conjunction} ${last}`
}
