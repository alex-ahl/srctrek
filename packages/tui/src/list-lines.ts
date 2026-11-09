import type { Row } from "./rows"

/** A line of the home screen's list: a section's heading, the gap before it, or a row. */
export type ListLine =
  { kind: "heading"; text: string } | { kind: "gap" } | { kind: "row"; row: Row; index: number }

const HEADINGS: Record<Row["kind"], string> = {
  proposal: "PROPOSED BY THE AGENT",
  trigger: "WAYS INTO THIS CODE",
  trek: "TREKS",
}

/** The rows under a heading per kind, with a gap between sections. */
export function listLines(rows: readonly Row[]): ListLine[] {
  return rows.flatMap((row, index): ListLine[] => {
    const line: ListLine = { kind: "row", row, index }
    if (index > 0 && rows[index - 1]?.kind === row.kind) {
      return [line]
    }

    const heading: ListLine = { kind: "heading", text: HEADINGS[row.kind] }
    return index === 0 ? [heading, line] : [{ kind: "gap" }, heading, line]
  })
}

/** Where the row at `index` sits among the lines. */
export function lineOfRow(lines: readonly ListLine[], index: number): number {
  return Math.max(
    0,
    lines.findIndex((line) => line.kind === "row" && line.index === index),
  )
}
