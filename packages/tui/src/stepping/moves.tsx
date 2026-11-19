import type { StepView } from "@srctrek/core"
import { TextAttributes } from "@opentui/core"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type Landing, type MoveRow, moveRows } from "./move-rows"

const lineText = (row: MoveRow) => (row.line === undefined ? "" : `line ${String(row.line)}`)

// "n  " before what a move does, and the column for the line it's about after it.
const KEY_WIDTH = 3
const LINE_WIDTH = 9

/**
 * The moves under their heading, beside the code: the key, what it does, its line, where to; the
 * moves about the cursor's line lit.
 */
export function MovesSection({
  view,
  room,
  cursor,
}: {
  view: StepView
  room: number
  cursor: number
}) {
  const tones = useTones()
  const textRoom = room - KEY_WIDTH - LINE_WIDTH

  return (
    <box flexDirection="column" style={{ marginBottom: 1 }}>
      <text fg={tones.dim}>MOVES</text>
      {moveRows(view).map((row) => (
        <box key={row.key} flexDirection="column">
          <text>
            <span fg={tones.accent}>{row.key.padEnd(KEY_WIDTH)}</span>
            <span
              fg={row.line === cursor ? tones.accent : COLOUR.text}
              {...(row.line === cursor ? { attributes: TextAttributes.BOLD } : {})}
            >
              {fit(row.text, textRoom).padEnd(textRoom)}
            </span>
            <span fg={tones.dim}>{lineText(row).padStart(LINE_WIDTH)}</span>
          </text>
          {row.to !== undefined && <LandingLines to={row.to} room={room} />}
        </box>
      ))}
    </box>
  )
}

// Under a move, where it lands, then its file and line on a line of their own.
function LandingLines({ to, room }: { to: Landing; room: number }) {
  const tones = useTones()
  return (
    <>
      <text fg={tones.dim}>{fit(`     lands on ${to.place}`, room)}</text>
      {to.at !== undefined && <text fg={tones.dim}>{fit(`     ${to.at}`, room)}</text>}
    </>
  )
}

// "O skip refund (line 11), lands on poll_once main.py:16".
function rowText(row: MoveRow): string {
  const line = row.line === undefined ? "" : ` (line ${String(row.line)})`
  const at = row.to?.at === undefined ? "" : ` ${row.to.at}`
  const to = row.to === undefined ? "" : `, lands on ${row.to.place}${at}`
  return `${row.key} ${row.text}${line}${to}`
}

/** The moves on one line, where there's no room for them beside the code. */
export function MovesLine({ view, width }: { view: StepView; width: number }) {
  const tones = useTones()
  return <text fg={tones.dim}>{fit(moveRows(view).map(rowText).join(" · "), width)}</text>
}
