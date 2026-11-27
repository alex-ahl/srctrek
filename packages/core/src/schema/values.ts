/** A part of a trek's text: the example's values, as the agent marked them, and the words around. */
export type TextPart = Readonly<{ text: string; value: boolean }>

const OPEN = "«"
const CLOSE = "»"

/** The text split at the values marked «so», the markers left out. */
export function valueParts(text: string): TextPart[] {
  return text
    .split(/(«[^«»]*»)/)
    .filter((part) => part !== "")
    .map((part) =>
      part.startsWith(OPEN) && part.endsWith(CLOSE)
        ? { text: part.slice(1, -1), value: true }
        : { text: part, value: false },
    )
}

/** The text as a reader says it, without the markers around its values. */
export const withoutMarkers = (text: string): string =>
  text.replaceAll(OPEN, "").replaceAll(CLOSE, "")

// What's wrong with a marker where it's found, `open` saying whether a value is open there.
function markerAt(char: string, open: boolean, next: string): string | undefined {
  if (char === OPEN && open) {
    return "a value is opened with « inside another"
  }

  if (char === CLOSE && !open) {
    return "» closes a value that was never opened with «"
  }

  return char === OPEN && next === CLOSE ? "«» marks no value" : undefined
}

/** What's wrong with the values marked in `text`: each opened with « and closed with », once. */
export function markerProblem(text: string): string | undefined {
  let open = false
  // by index: the markers are one unit each, wherever they sit among others
  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at)
    const problem = markerAt(char, open, text.charAt(at + 1))
    if (problem !== undefined) {
      return problem
    }

    if (char === OPEN || char === CLOSE) {
      open = char === OPEN
    }
  }

  return open ? "a value opened with « is never closed with »" : undefined
}
