/** A change in the user's words, split as a shell would split it: "../api main...feature". */
export function wordsOf(change: string | undefined): string[] {
  return (change ?? "").split(/\s+/).filter(Boolean)
}
