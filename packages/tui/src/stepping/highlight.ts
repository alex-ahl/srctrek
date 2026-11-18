import { getTreeSitterClient, pathToFiletype } from "@opentui/core"
import { useEffect, useState } from "react"
import type { Tone } from "../ui/theme"

/** A run of a line's text in one colour; `tone` undefined is the terminal's own text colour. */
export type Span = Readonly<{ text: string; tone: Tone | undefined; italic: boolean }>

// The tones code is drawn in, by what tree-sitter calls each part, most specific name first;
// the palette's own tones, so code follows the terminal's light or dark colours.
const CAPTURE_TONES: readonly (readonly [string, Tone])[] = [
  ["comment", "dim"],
  ["string", "good"],
  ["keyword", "busy"],
  ["function", "accent"],
  ["method", "accent"],
  ["constructor", "accent"],
  ["type", "warn"],
  ["number", "bad"],
  ["boolean", "bad"],
  ["constant", "bad"],
]

function toneOf(capture: string): Tone | undefined {
  return CAPTURE_TONES.find(([name]) => capture === name || capture.startsWith(`${name}.`))?.[1]
}

type Highlight = readonly [number, number, string, ...unknown[]]

// Each character's tone, a later highlight over an earlier one: tree-sitter gives the general
// name first ("variable"), then the specific ("function").
function tonesByCharacter(text: string, highlights: readonly Highlight[]): (Tone | undefined)[] {
  const tones: (Tone | undefined)[] = Array.from({ length: text.length }, () => undefined)
  for (const [start, end, capture] of highlights) {
    const tone = toneOf(capture)
    if (tone !== undefined) {
      tones.fill(tone, start, end)
    }
  }

  return tones
}

/** The file's lines as runs of one tone each, from tree-sitter's highlights over its text. */
export function spansOf(text: string, highlights: readonly Highlight[]): Span[][] {
  const tones = tonesByCharacter(text, highlights)
  const lines: Span[][] = [[]]
  let run = ""
  let tone: Tone | undefined
  const close = () => {
    if (run !== "") {
      lines.at(-1)?.push({ text: run, tone, italic: tone === "dim" })
    }
    run = ""
  }

  for (let at = 0; at < text.length; at++) {
    const char = text[at] ?? ""
    if (char === "\n") {
      close()
      lines.push([])
      continue
    }

    if (tones[at] !== tone) {
      close()
      tone = tones[at]
    }
    run += char
  }
  close()

  return lines
}

/** `spans` cut to `width` columns, tabs as two spaces, the last one cut with an ellipsis. */
export function fittedSpans(spans: readonly Span[], width: number): Span[] {
  const runs: Span[] = []
  let room = width
  for (const span of spans) {
    if (room <= 0) {
      break
    }

    const text = span.text.replaceAll("\t", "  ")
    const cut = text.length > room ? `${text.slice(0, Math.max(0, room - 1))}…` : text
    runs.push({ ...span, text: cut })
    room -= cut.length
  }

  return runs
}

/** The file at `path`, its text coloured by language; none until worked out, or for a language tree-sitter doesn't know. */
export function useHighlighted(text: string, path: string): Span[][] | undefined {
  // the spans with the text they were worked out from, so a new file never shows the last one's
  const [worked, setWorked] = useState<{ text: string; spans: Span[][] } | undefined>(undefined)

  useEffect(() => {
    const filetype = pathToFiletype(path)
    if (filetype === undefined || text === "") {
      return undefined
    }

    let current = true
    const client = getTreeSitterClient()
    void client
      .initialize()
      .then(() => client.highlightOnce(text, filetype))
      .then(
        ({ highlights }) =>
          current &&
          highlights !== undefined &&
          setWorked({ text, spans: spansOf(text, highlights) }),
        () => undefined,
      )
    return () => {
      current = false
    }
  }, [text, path])

  return worked?.text === text ? worked.spans : undefined
}
