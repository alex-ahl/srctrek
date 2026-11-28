import { type TextPart, valueParts } from "@srctrek/core"
import { Separated } from "./separated"
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

// A line break in the text, "↵", and the spaces around it.
const LINE_BREAK = / *↵ */g

// Where each of the text's lines starts and ends, between its line breaks.
function linesOf(plain: string): (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = []
  let start = 0
  for (const found of plain.matchAll(LINE_BREAK)) {
    spans.push([start, found.index])
    start = found.index + found[0].length
  }

  return [...spans, [start, plain.length]]
}

// One of the text's lines wrapped to `width`, each wrapped line in its values and the rest.
function wrapLine(line: string, values: readonly boolean[], width: number): TextPart[][] {
  let at = 0
  return wrap(line, width).map((part) => {
    const start = at
    // a wrap takes the space it replaces
    at += part.length + 1
    return runsOf(part, values.slice(start, start + part.length))
  })
}

/**
 * Text with the example's values marked «so», wrapped to `width` as a reader says it, a new line
 * at each ↵, each line in its values and the words around them.
 */
export function wrapValues(text: string, width: number): TextPart[][] {
  const parts = valueParts(text)
  const plain = parts.map((part) => part.text).join("")
  const values = parts.flatMap((part) => Array.from({ length: part.text.length }, () => part.value))
  return linesOf(plain).flatMap(([start, end]) =>
    wrapLine(plain.slice(start, end), values.slice(start, end), width),
  )
}

/** The most lines a trigger or an outcome takes on a screen. */
export const MOST_LINES = 8

/** Lines kept to `MOST_LINES`, the last given up to say how many more there are. */
export function capped<T>(lines: readonly T[]): Readonly<{ shown: readonly T[]; more: number }> {
  if (lines.length <= MOST_LINES) {
    return { shown: lines, more: 0 }
  }

  const shown = lines.slice(0, MOST_LINES - 1)
  return { shown, more: lines.length - shown.length }
}

/** "… 24 more lines", dimmed, under lines `capped` cut, from `indent`; nothing when none were. */
export function MoreLines({ more, indent }: { more: number; indent: number }) {
  const tones = useTones()
  if (more === 0) {
    return null
  }

  return <text fg={tones.dim}>{`${" ".repeat(indent)}… ${String(more)} more lines`}</text>
}

/**
 * A line of text, its values in their tone and the rest as the line around it draws, separators
 * dimmed.
 */
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
          <Separated key={at} text={part.text} />
        ),
      )}
    </>
  )
}
