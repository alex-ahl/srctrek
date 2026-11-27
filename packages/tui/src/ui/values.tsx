import { type TextPart, valueParts } from "@srctrek/core"
import { wrap } from "./text"
import { useTones } from "./theme"

// A line split where it moves between the example's values and the words around them, `values`
// saying of each of its units which it is: the markers are one unit each, so a split never falls
// inside a character.
function runsOf(line: string, values: readonly boolean[]): TextPart[] {
  const runs: TextPart[] = []
  for (let at = 0; at < line.length; at += 1) {
    const value = values[at] ?? false
    const last = runs.at(-1)
    if (last?.value === value) {
      runs[runs.length - 1] = { text: last.text + line.charAt(at), value }
    } else {
      runs.push({ text: line.charAt(at), value })
    }
  }

  return runs
}

/**
 * Text with the example's values marked «so», wrapped to `width` as a reader says it, each line in
 * its values and the words around them.
 */
export function wrapValues(text: string, width: number): TextPart[][] {
  const parts = valueParts(text)
  const plain = parts.map((part) => part.text).join("")
  const values = parts.flatMap((part) => Array.from({ length: part.text.length }, () => part.value))
  let at = 0
  return wrap(plain, width).map((line) => {
    const start = at
    // a line break takes the space it replaces
    at += line.length + 1
    return runsOf(line, values.slice(start, start + line.length))
  })
}

/** A line of text, its values in their tone and the rest as the line around it draws. */
export function Valued({ line }: { line: readonly TextPart[] }) {
  const tones = useTones()
  return (
    <>
      {line.map((part, at) =>
        part.value ? (
          <span key={at} fg={tones.value}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  )
}
