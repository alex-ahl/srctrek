import type { MoveTarget, StepRef, StepView } from "@srctrek/core"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

/**
 * A move's key, what it does in words, the code line it's about (a call's), and where it lands
 * when the words don't say.
 */
export type MoveRow = Readonly<{
  key: string
  text: string
  line: number | undefined
  to: string | undefined
}>

type Named = Pick<StepRef, "name" | "file" | "start_line">

const fileLine = (ref: Named) =>
  `${ref.file.split("/").at(-1) ?? ref.file}:${String(ref.start_line)}`

const nameOf = (ref: Named) => ref.name ?? fileLine(ref)

// Where a move lands: its name, with its repo when that isn't the step's; the end past the last.
function placeOf(target: MoveTarget | null, repo: string): string {
  if (target === null) {
    return "the end"
  }

  return target.repo === repo ? nameOf(target) : `${target.repo}: ${nameOf(target)}`
}

// Where n goes in words: into a call, across a hop, back to a caller, on, or the end.
function nextRow(view: StepView): MoveRow {
  const { next, moves } = view
  const place = placeOf(moves.next, view.repo)
  const words = {
    into: `into ${place}`,
    hop: `↯ ${place}`,
    back: `back to ${place}`,
    on: `on to ${place}`,
    end: "the end",
  }

  return { key: "n", text: words[next.how], line: next.line ?? undefined, to: undefined }
}

// Into the call on its own line, where that isn't where n goes.
function intoRow(view: StepView): MoveRow[] {
  const target = view.moves.into
  if (target === null || target.id === view.moves.next?.id) {
    return []
  }

  const call = view.calls.find((each) => each.id === target.id)
  const line = call?.call_line ?? undefined
  return [{ key: "i", text: `into ${placeOf(target, view.repo)}`, line, to: undefined }]
}

// What over skips: the step's one call and its line, else its calls.
function skipped(view: StepView): Pick<MoveRow, "text" | "line"> {
  const [only, ...more] = view.calls
  if (only === undefined || more.length > 0) {
    return { text: "skip its calls", line: undefined }
  }

  return { text: `skip ${nameOf(only)}`, line: only.call_line ?? undefined }
}

// Over and out, where they land somewhere n doesn't.
function leavingRows(view: StepView): MoveRow[] {
  const { moves } = view
  const elsewhere = (target: MoveTarget | null) => target?.id !== moves.next?.id
  const over: MoveRow = { key: "O", ...skipped(view), to: placeOf(moves.over, view.repo) }
  const out: MoveRow = {
    key: "o",
    text: `finish ${nameOf(view)}`,
    line: undefined,
    to: placeOf(moves.out, view.repo),
  }

  return [...(elsewhere(moves.over) ? [over] : []), ...(elsewhere(moves.out) ? [out] : [])]
}

/** Each move from the step, n first; one landing where n does isn't repeated. */
export function moveRows(view: StepView): MoveRow[] {
  return [nextRow(view), ...intoRow(view), ...leavingRows(view)]
}

const lineText = (row: MoveRow) => (row.line === undefined ? "" : `line ${String(row.line)}`)

// "n  " before what a move does, and the column for the line it's about after it.
const KEY_WIDTH = 3
const LINE_WIDTH = 9

/** The moves under their heading, beside the code: the key, what it does, its line, where to. */
export function MovesSection({ view, room }: { view: StepView; room: number }) {
  const tones = useTones()
  const textRoom = room - KEY_WIDTH - LINE_WIDTH

  return (
    <box flexDirection="column" style={{ marginBottom: 1 }}>
      <text fg={tones.dim}>MOVES</text>
      {moveRows(view).map((row) => (
        <box key={row.key} flexDirection="column">
          <text>
            <span fg={tones.accent}>{row.key.padEnd(KEY_WIDTH)}</span>
            <span fg={COLOUR.text}>{fit(row.text, textRoom).padEnd(textRoom)}</span>
            <span fg={tones.dim}>{lineText(row).padStart(LINE_WIDTH)}</span>
          </text>
          {row.to !== undefined && <text fg={tones.dim}>{fit(`     → ${row.to}`, room)}</text>}
        </box>
      ))}
    </box>
  )
}

// "O skip refund (line 11) → poll_once".
function rowText(row: MoveRow): string {
  const line = row.line === undefined ? "" : ` (line ${String(row.line)})`
  const to = row.to === undefined ? "" : ` → ${row.to}`
  return `${row.key} ${row.text}${line}${to}`
}

/** The moves on one line, where there's no room for them beside the code. */
export function MovesLine({ view, width }: { view: StepView; width: number }) {
  const tones = useTones()
  return <text fg={tones.dim}>{fit(moveRows(view).map(rowText).join(" · "), width)}</text>
}
