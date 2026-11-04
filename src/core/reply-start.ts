// What pressing an ID in the pane's waiting line appends to the reply box to
// start an answer to a thread: its ID as the prefix of a line, unless the
// draft already starts a line with it (T50 and T5.1 are other IDs, not T5).
export const replyStart = (draft: string, id: string): string => {
  if (startsALine(draft, id)) return ''
  const separator = draft === '' || draft.endsWith('\n') ? '' : '\n'
  return `${separator}${id}: `
}

const startsALine = (draft: string, id: string): boolean => {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}(?!\\d|\\.\\d)`, 'im').test(draft)
}
