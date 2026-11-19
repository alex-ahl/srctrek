import type { StepView } from "@srctrek/core"
import { type MoveRow, keysOn, moveRows } from "./move-rows"

/** What a code line shows besides its text: its sign, whether it's in the step, what's at its end. */
export type CodeLine = Readonly<{
  number: number
  text: string
  sign: string
  inStep: boolean
  // the values the trek predicts on this line, and the arrows to the steps it leads to, each
  // followed by the keys of the moves about it
  values: string
  arrows: string
  // the line next goes into from
  leadsNext: boolean
}>

const CHANGE_SIGNS = { added: "+", changed: "~" } as const

// `name ≈ value`, `returns ≈ value`, "≈?" when the trek doubts it.
function valueText(value: StepView["predicted_values"][number]): string {
  const subject = value.role === "return" ? "returns" : value.name
  return `${subject} ${value.uncertain === true ? "≈?" : "≈"} ${value.value}`
}

function valuesOn(view: StepView, line: number): string {
  return view.predicted_values
    .filter((value) => value.line === line)
    .map(valueText)
    .join("  ")
}

// An arrow for each step the line leads to, a hop's repo named, a guessed link marked; then the
// keys of the moves about the line: "→ n O".
function arrowsOn(view: StepView, rows: readonly MoveRow[], line: number): string {
  const arrows = view.calls
    .filter((call) => call.call_line === line)
    .map((call) => `${call.repo === view.repo ? "→" : `↯ ${call.repo}`}${call.guessed ? "?" : ""}`)

  return [...arrows, keysOn(rows, line)].filter((part) => part !== "").join(" ")
}

function signOf(view: StepView, line: number): string {
  if (line === view.start_line) {
    return "▶"
  }

  const changed = view.changed_lines.find((each) => each.line === line)
  return changed === undefined ? "" : CHANGE_SIGNS[changed.change]
}

/** The file's lines from `first` to `last`, each with its sign, end, and place in the step. */
export function codeLines(view: StepView, text: string, first: number, last: number): CodeLine[] {
  const all = text.split("\n")
  const leads = view.next.how === "into" || view.next.how === "hop" ? view.next.line : null
  const rows = moveRows(view)

  return all.slice(first - 1, last).map((line, i) => {
    const number = first + i
    return {
      number,
      text: line,
      sign: signOf(view, number),
      inStep: number >= view.start_line && number <= view.end_line,
      values: valuesOn(view, number),
      arrows: arrowsOn(view, rows, number),
      leadsNext: number === leads,
    }
  })
}

/**
 * How a file is laid out to step through: its length, the lines that fit, the first line shown
 * at the stop, the last first line there can be, and the stop's first line.
 */
export type Layout = Readonly<{
  lines: number
  room: number
  atStop: number
  latest: number
  stop: number
}>

/** Where the cursor is, and the first line in view. */
export type Place = Readonly<{ cursor: number; top: number }>

// Lines kept between the cursor and the view's edge as it moves, where the file allows.
const MARGIN = 3

/**
 * The lines shown in `height` rows: from `top`, or at the stop, the step near the top with a few
 * lines above it and `band` rows of narration over it, never past the file's end; and the file's
 * layout, for moving the cursor.
 */
export function windowOf(
  view: Pick<StepView, "start_line">,
  lineCount: number,
  height: number,
  band: number,
  top?: number,
) {
  const room = Math.max(1, height - band)
  const latest = Math.max(1, lineCount - room + 1)
  const atStop = Math.min(Math.max(1, view.start_line - 3), latest)
  const first = Math.min(Math.max(1, top ?? atStop), latest)
  const layout: Layout = { lines: lineCount, room, atStop, latest, stop: view.start_line }

  return { first, last: Math.min(lineCount, first + room - 1), layout }
}

/** The cursor at the stop, the view as it opens there. */
export const atStop = (layout: Layout): Place => ({ cursor: layout.stop, top: layout.atStop })

/**
 * The place after moving the cursor `by` lines, kept within the file; the view follows only as
 * the cursor comes within a few lines of its edge, as an editor's does.
 */
export function movedPlace(place: Place, by: number, layout: Layout): Place {
  const cursor = Math.min(Math.max(1, place.cursor + by), layout.lines)
  const margin = Math.min(MARGIN, Math.floor((layout.room - 1) / 2))
  const lowest = cursor - layout.room + 1 + margin
  const highest = cursor - margin
  const top = Math.min(Math.max(place.top, lowest), highest)

  return { cursor, top: Math.min(Math.max(1, top), layout.latest) }
}
