import type { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/react"
import type { TrekStatus } from "@srctrek/core"
import type { LandingGroup, LandingRow } from "./rows"
import { rowKey, workedOut } from "./statuses"
import { firstShown, noteIndex, startsGroup } from "./window"
import { statusBlock } from "../change/status-block"
import { PADDING } from "../ui/layout"
import { Selectable } from "../ui/selectable"
import { DONE_SYMBOL } from "../ui/state-labels"
import { useTurning } from "../ui/turning"
import { fit, shortAge } from "../ui/text"
import { useNow } from "../ui/clock"
import { COLOUR, type Tone, useTones } from "../ui/theme"
import { SEPARATOR } from "../ui/separator"

/** What a heading says of a group with nothing to open in it: still loading, none, or why not. */
export type LandingNote = Readonly<{ group: LandingGroup; text: string; tone: Tone }>

// The widest the table runs, the selection marker's room included: past it, on a very wide
// terminal, a row's state would sit too far across the screen from its name.
const TABLE_MOST = 120

// Names are cut past this share of the row, leaving room for what they hold and their states;
// and before what they hold would have less than this, as on a narrow terminal.
const NAME_SHARE = 0.5
const DETAIL_LEAST = 20

// Rows set in under their group's name; the selection marker's room; the gap after a group's name
// before what it says; between columns.
const ROW_INDENT = "  "
const MARKER = 2
const GAP = "  "
const COLUMN_GAP = "    "

// Code as it is's, "ways in" being in its name.
const STATE_WORDS: Readonly<Record<string, string>> = {
  "ways in not found yet": "not found yet",
}

// The opening state's text, which the states' column always has room for.
const OPENING = "◐ opening…"

/**
 * A row's trek state as its column words it, the tone it's drawn in, and, for a trek that's built,
 * when, dimmed after it: "built 2h ago".
 */
type StateCell = Readonly<{ text: string; tone: Tone; age?: string }>

// The state and its age as wide as they're drawn.
const cellText = (cell: StateCell, ages: boolean) =>
  !ages || cell.age === undefined ? cell.text : `${cell.text}${GAP}${cell.age}`

// The states a trek is saved in, whose age is when it was built.
const BUILT_KINDS: ReadonlySet<TrekStatus["kind"]> = new Set([
  "ready",
  "stale",
  "older-guide",
  "newer-guide",
])

// "● ready", "≠ stale", "○ no trek yet": in the words and colours a change's screen uses; code
// as it is says where finding its ways in stands; a done trek how its work ended, "✓ merged";
// turning while being opened or worked out.
function stateCell(
  row: LandingRow,
  status: TrekStatus | undefined,
  opening: boolean,
  turning: string,
  built: (name: string) => string | undefined,
): StateCell {
  if (opening) {
    return { text: `${turning} opening…`, tone: "busy" }
  }

  if (row.choice.kind === "trek") {
    return { text: `${DONE_SYMBOL} ${row.choice.why}`, tone: "dim" }
  }

  if (status === undefined) {
    return { text: workedOut(row) ? turning : "", tone: "dim" }
  }

  const { symbol, state, tone } = statusBlock(status, false, {
    code: row.choice.kind === "code",
  })
  const text = `${symbol} ${STATE_WORDS[state] ?? state}`
  const when = BUILT_KINDS.has(status.kind) ? built(status.name) : undefined
  return when === undefined ? { text, tone } : { text, tone, age: `built ${when}` }
}

// The uncommitted work on the user's branch, set in under it as its own.
const indentOf = (row: LandingRow) =>
  row.choice.kind === "own" && row.choice.uncommitted ? "  " : ""

// What a row holds in the room a mark leaves it, the separator's room among it; given up whole
// where less than a character would show.
function fitBeside(detail: string, room: number): string {
  const left = detail === "" ? 0 : room - SEPARATOR.length
  return left < 2 ? "" : fit(detail, left)
}

// The table's columns: the names', what they hold, the states'.
type Widths = Readonly<{ name: number; detail: number; state: number; ages: boolean }>

// A row's name, as wide as it's drawn.
const nameText = (row: LandingRow) => indentOf(row) + row.label

// What a row holds and its mark, as wide as they're drawn.
const detailText = (row: LandingRow) => [row.detail, row.mark ?? ""].filter(Boolean).join(SEPARATOR)

// A row's name column: set in for uncommitted work, its name cut to fit, and the room after it.
function nameCells(row: LandingRow, width: number) {
  const indent = indentOf(row)
  const label = fit(row.label, width - indent.length)
  const after = " ".repeat(Math.max(width - indent.length - label.length, 0))

  return { indent, label, after }
}

// A row's middle column: what it holds, cut to leave its mark whole where it can, the separator
// between them where both show, and the room after them.
function detailCells(row: LandingRow, width: number) {
  const mark = row.mark === undefined ? "" : fit(row.mark, width)
  const detail = mark === "" ? fit(row.detail, width) : fitBeside(row.detail, width - mark.length)
  const between = detail !== "" && mark !== "" ? SEPARATOR : ""
  const rest = " ".repeat(Math.max(width - detail.length - between.length - mark.length, 0))

  return { detail, between, mark, rest }
}

// One change to open, a row of the table: its name, what it holds, dimmed, with a mark in the
// accent, and its trek's state; all of it dimmed while the sheet over the list has the keys.
function ChangeView({
  row,
  cell,
  widths,
  muted,
}: {
  row: LandingRow
  cell: StateCell
  widths: Widths
  muted: boolean
}) {
  const tones = useTones()
  const { indent, label, after } = nameCells(row, widths.name)
  const { detail, between, mark, rest } = detailCells(row, widths.detail)

  return (
    <span>
      {indent}
      <span {...(muted ? { fg: tones.dim } : {})}>{label}</span>
      {after}
      {COLUMN_GAP}
      <span fg={tones.dim}>{detail}</span>
      {mark !== "" && (
        <span>
          <span fg={tones.dim}>{between}</span>
          <span fg={muted ? tones.dim : tones.accent}>{mark}</span>
        </span>
      )}
      {rest}
      {COLUMN_GAP}
      <span fg={tones[muted ? "dim" : cell.tone]}>{cell.text}</span>
      {widths.ages && cell.age !== undefined && <span fg={tones.dim}>{`${GAP}${cell.age}`}</span>}
    </span>
  )
}

// A state's symbol alone: "●" of "● ready".
const symbolOf = (cell: StateCell) => cell.text.split(" ")[0] ?? ""

/** What sets a row apart after its state, beside a change's screen: one mark, or none. */
type Mark = Readonly<{ symbol: string; tone: Tone }>

// A likely-wrong step in its trek before a review waiting on the user: the one to look at first.
const markOf = (row: LandingRow, flagged: boolean): Mark | undefined => {
  if (flagged) {
    return { symbol: "⚠", tone: "bad" }
  }

  return row.mark === undefined ? undefined : { symbol: "⚑", tone: "accent" }
}

// One change beside a change's screen: its name, then its trek's state as a symbol and its mark,
// lined up at the list's right.
function NameView({
  row,
  cell,
  mark,
  width,
  muted,
}: {
  row: LandingRow
  cell: StateCell
  mark: Mark | undefined
  width: number
  muted: boolean
}) {
  const tones = useTones()
  const { indent, label, after } = nameCells(row, width)

  return (
    <span>
      {indent}
      <span {...(muted ? { fg: tones.dim } : {})}>{label}</span>
      {after}
      {GAP}
      <span fg={tones[muted ? "dim" : cell.tone]}>{symbolOf(cell)}</span>
      <span fg={tones[muted ? "dim" : (mark?.tone ?? "dim")]}>{` ${mark?.symbol ?? " "}`}</span>
    </span>
  )
}

// A group's name in the accent, with how many rows it holds, at the page's left, its rows set in
// under it, and what it says of a group with nothing in it: "pull requests  none"; a blank line
// before it but the first.
function Heading(props: {
  group: LandingGroup
  first: boolean
  count?: number | undefined
  note?: LandingNote | undefined
}) {
  const tones = useTones()
  const { note, count } = props

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {!props.first && <text fg={COLOUR.text}> </text>}
      <text fg={tones.accent}>
        {props.group}
        {count !== undefined && <span fg={tones.dim}>{` ${String(count)}`}</span>}
        {note !== undefined && <span fg={tones[note.tone]}>{`${GAP}${note.text}`}</span>}
      </text>
    </box>
  )
}

// How many rows each group holds, those scrolled out of view among them.
const countsOf = (items: readonly LandingRow[]): ReadonlyMap<LandingGroup, number> =>
  items.reduce(
    (counts, item) => counts.set(item.group, (counts.get(item.group) ?? 0) + 1),
    new Map(),
  )

// Whether a row's state is turning: a change being opened, or one still being worked out.
const busy = (
  items: readonly LandingRow[],
  statuses: ReadonlyMap<string, TrekStatus>,
  opening: string | undefined,
) => opening !== undefined || items.some((item) => workedOut(item) && !statuses.has(rowKey(item)))

// Each row's state cell, by its key.
function cellsOf(
  rows: readonly LandingRow[],
  statuses: ReadonlyMap<string, TrekStatus>,
  opening: string | undefined,
  turning: string,
  built: (name: string) => string | undefined,
): ReadonlyMap<string, StateCell> {
  return new Map(
    rows.map((row) => {
      const key = rowKey(row)
      return [key, stateCell(row, statuses.get(key), key === opening, turning, built)]
    }),
  )
}

// The table across the row: what the rows hold as wide as they need, names taking the room left,
// up to their longest; on a narrow terminal, names cut past their share of the row before what the
// rows hold gives up more than its least; the states as wide as theirs, opening one's room kept,
// ending at the row's end.
function widthsOf(
  rows: readonly LandingRow[],
  cells: ReadonlyMap<string, StateCell>,
  width: number,
): Widths {
  const room = Math.min(width - 2 * PADDING, TABLE_MOST) - ROW_INDENT.length - MARKER
  const gaps = 2 * COLUMN_GAP.length
  const longest = (texts: readonly string[]) => Math.max(0, ...texts.map((text) => text.length))
  const longestName = longest(rows.map(nameText))
  // what the rows hold, whole, and at the least on a narrow terminal
  const need = longest(rows.map(detailText))
  const keep = Math.min(need, DETAIL_LEAST)
  // the most a name can be cut to before what the rows hold gives up its room instead
  const fair = Math.min(longestName, Math.floor(room * NAME_SHARE))
  const states = (ages: boolean) =>
    Math.max(OPENING.length, longest([...cells.values()].map((cell) => cellText(cell, ages))))
  // a trek's age only where the names and what they hold keep their room beside it
  const ages = room - states(true) - gaps - keep >= fair
  const state = states(ages)
  const beside = room - state - gaps
  const name =
    beside - need >= fair
      ? Math.min(longestName, beside - need)
      : Math.max(Math.min(fair, beside - keep), 0)

  return { name, detail: Math.max(beside - name, 0), state, ages }
}

const NO_CELL: StateCell = { text: "", tone: "dim" }

const NONE_FLAGGED: ReadonlySet<string> = new Set()

// The names' room beside a change's screen: the list's, less the rows' indent, the marker, and a
// state's symbol and its mark after its gap.
const namesWidth = (width: number) =>
  width - 2 * PADDING - ROW_INDENT.length - MARKER - GAP.length - 3

/**
 * Everything to open under its heading, the selected line on the tint; the note on the pull
 * requests, for when there are none to open yet, sits where they would.
 */
export function LandingList({
  items,
  chosen,
  statuses,
  builtAt,
  opening,
  note,
  muted,
  tint,
  height,
  namesOnly = false,
  flagged = NONE_FLAGGED,
  width: shownWidth,
}: {
  items: readonly LandingRow[]
  chosen: number
  statuses: ReadonlyMap<string, TrekStatus>
  // when each saved trek was built, by its name
  builtAt: ReadonlyMap<string, string>
  // the key of the change being opened
  opening: string | undefined
  note: LandingNote | undefined
  // dimmed, under the sheet that has the keys
  muted: boolean
  tint: RGBA | undefined
  // the lines there's room for
  height: number
  // beside a change's screen: each change's name and its state's symbol, what it holds there
  namesOnly?: boolean
  // the treks with a step the agent marked likely wrong, by name
  flagged?: ReadonlySet<string>
  // the columns the list has, the terminal's unless given
  width?: number | undefined
}) {
  const terminal = useTerminalDimensions()
  const width = shownWidth ?? terminal.width
  const turning = useTurning(busy(items, statuses, opening))
  const now = useNow()
  const built = (name: string) => {
    const at = builtAt.get(name)
    return at === undefined ? undefined : shortAge(at, now)
  }
  const tones = useTones()
  const cells = cellsOf(items, statuses, opening, turning, built)
  const counts = countsOf(items)
  const isFlagged = (item: LandingRow) => flagged.has(statuses.get(rowKey(item))?.name ?? "")
  const widths = widthsOf(items, cells, width)
  const noteAt = noteIndex(items)
  const start = firstShown(items, chosen, noteAt, note !== undefined, height)

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {items.slice(start).map((item, shown) => {
        const index = start + shown
        return (
          <box key={rowKey(item)} flexDirection="column" style={{ flexShrink: 0 }}>
            {index === noteAt && <Note note={note} first={index === 0} />}
            {(startsGroup(items[index - 1], item) || shown === 0) && (
              <Heading
                group={item.group}
                count={counts.get(item.group)}
                first={index === start && noteAt !== index}
              />
            )}
            <Selectable
              selected={index === chosen}
              tint={tint}
              indent={ROW_INDENT}
              edge={namesOnly ? tones[(cells.get(rowKey(item)) ?? NO_CELL).tone] : undefined}
            >
              {namesOnly ? (
                <NameView
                  row={item}
                  cell={cells.get(rowKey(item)) ?? NO_CELL}
                  mark={markOf(item, isFlagged(item))}
                  width={namesWidth(width)}
                  muted={muted}
                />
              ) : (
                <ChangeView
                  row={item}
                  cell={cells.get(rowKey(item)) ?? NO_CELL}
                  widths={widths}
                  muted={muted}
                />
              )}
            </Selectable>
          </box>
        )
      })}
      {noteAt === items.length && <Note note={note} first={items.length === 0} />}
    </box>
  )
}

function Note({ note, first }: { note: LandingNote | undefined; first: boolean }) {
  return note === undefined ? null : <Heading group={note.group} first={first} note={note} />
}
