import { type CapturedFrame, type CapturedSpan, TextAttributes } from "@opentui/core"
import { colourName } from "./palettes"

const ATTRIBUTE_NAMES: readonly (readonly [number, string])[] = [
  [TextAttributes.BOLD, "bold"],
  [TextAttributes.DIM, "dim"],
  [TextAttributes.ITALIC, "italic"],
  [TextAttributes.UNDERLINE, "underline"],
  [TextAttributes.INVERSE, "inverse"],
]

// "green bold", "default on bright black": what sets a span apart; empty when nothing does.
function styleOf(span: CapturedSpan): string {
  const fg = colourName(span.fg)
  const bg = colourName(span.bg)
  const attributes = ATTRIBUTE_NAMES.filter(([bit]) => (span.attributes & bit) !== 0).map(
    ([, name]) => name,
  )
  const colours = [
    fg === "default" && bg === "default" ? "" : fg,
    bg === "default" ? "" : `on ${bg}`,
  ]

  return [...colours, ...attributes].filter(Boolean).join(" ")
}

// " 3: 2-9 green bold  12-30 bright black": each styled span on a row, by its columns.
function styledRuns(spans: readonly CapturedSpan[], row: number): string | undefined {
  const runs: string[] = []
  let col = 0
  for (const span of spans) {
    const style = styleOf(span)
    if (style !== "" && span.text.trim() !== "") {
      runs.push(`${col}-${col + span.width - 1} ${style}`)
    }

    col += span.width
  }

  return runs.length === 0 ? undefined : `${String(row).padStart(2)}: ${runs.join("  ")}`
}

/**
 * The screen as text: each row as it reads, then a line per row naming where its colours and
 * attributes are, so a check can be read without the picture.
 */
export function screenText(frame: CapturedFrame): string {
  const rows = frame.lines.map((line) =>
    line.spans
      .map((span) => span.text)
      .join("")
      .trimEnd(),
  )
  const styles = frame.lines.flatMap((line, row) => styledRuns(line.spans, row) ?? [])

  return [...rows, "", "styles:", ...styles].join("\n") + "\n"
}
