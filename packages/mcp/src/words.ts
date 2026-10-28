// A word is a run of non-spaces and quoted parts: --code="a refund request" is one word.
const WORD = /(?:[^\s"]+|"[^"]*")+/g

/**
 * A change in the user's words, split as a shell would split it, quotes removed:
 * "../api main...feature", "--code=\"a refund request\"".
 */
export function wordsOf(change: string | undefined): string[] {
  const words = (change ?? "").match(WORD) ?? []

  return words.map((word) => word.replaceAll('"', ""))
}
