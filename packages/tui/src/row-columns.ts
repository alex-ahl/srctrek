import type { TrekEntry, TrekStatus } from "@srctrek/core"
import { type States, detailOf, stateOf } from "./row-state"
import type { Row } from "./rows"
import { PADDING } from "./layout"
import { builtWhen } from "./text"

/**
 * How wide each column is, from what the rows hold, 0 for a column no row fills; the title is as
 * wide as the longest, within what the others leave.
 */
export type Columns = Readonly<{
  state: number
  title: number
  detail: number
  flags: number
  built: number
}>

export const GAP = 3
// The built column needs room; a narrow terminal leaves it out.
const BUILT_FROM_WIDTH = 90
/** The marker before every row, and the screen's padding on either side. */
export const EDGES = 2 + 2 * PADDING
const TITLE_MIN = 16
// A longer title is cut, so a wide terminal keeps a row's columns together.
const TITLE_MAX = 50

const widest = (texts: readonly string[]) => Math.max(0, ...texts.map((text) => text.length))
const column = (texts: readonly string[]) => (widest(texts) === 0 ? 0 : widest(texts) + GAP)

type Valid = Extract<TrekEntry, { valid: true }>

// What a row shows in the title column; a proposal spreads past it, so it doesn't count.
function titleOf(row: Row): string {
  if (row.kind === "proposal") {
    return ""
  }

  if (row.kind === "trigger") {
    return row.found.trigger.name
  }

  return row.entry.valid ? row.entry.title : row.entry.name
}

export const flagsText = (entry: Valid) => (entry.highFlags > 0 ? `⚠ ${entry.highFlags}` : "")

export const builtText = (entry: Valid, now: Date) => `built ${builtWhen(entry.createdAt, now)}`

/** The columns for `rows` on a screen `width` wide. */
export function columnsOf(
  rows: readonly Row[],
  width: number,
  context: Readonly<{ status: TrekStatus | undefined; states: States; now: Date }>,
): Columns {
  const { status, states, now } = context
  const valid = rows.flatMap((row) => (row.kind === "trek" && row.entry.valid ? [row.entry] : []))
  const labels = rows.flatMap((row) => {
    const label = stateOf(row, status, states)
    return label === undefined ? [] : [`${label.symbol} ${label.state}`]
  })
  const proposes = rows.some((row) => row.kind === "proposal")

  const state = column([...labels, ...(proposes ? ["+ proposed"] : [])])
  const detail = column(valid.map((entry) => detailOf(entry, status, states)))
  const flags = column(valid.map(flagsText))
  const built = width >= BUILT_FROM_WIDTH ? widest(valid.map((entry) => builtText(entry, now))) : 0
  const room = Math.max(TITLE_MIN, width - EDGES - state - detail - flags - built)
  const longest = Math.min(TITLE_MAX, widest(rows.map(titleOf)))
  const title = Math.min(room, Math.max(TITLE_MIN, longest + GAP))

  return { state, title, detail, flags, built }
}
