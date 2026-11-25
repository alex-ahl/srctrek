import type { RGBA } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/react"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { LandingGroup, LandingRow, PullHead } from "./rows"
import { statusBlock } from "../change/status-block"
import { PADDING } from "../ui/layout"
import { Selectable } from "../ui/selectable"
import { DONE_SYMBOL } from "../ui/state-labels"
import { useTurning } from "../ui/turning"
import { fit, shortAge } from "../ui/text"
import { useNow } from "../ui/clock"
import { COLOUR, type Tone, useTones } from "../ui/theme"

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

/** A row's key, which keeps it selected while the lines around it come and go. */
export const rowKey = (row: LandingRow): string => JSON.stringify(row.choice)

/** How the landing page reads where each row's trek stands: a change's, and a pull request's. */
export type StatusOf = Readonly<{
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  pullStatus: (pr: PullHead) => Promise<TrekStatus>
}>

// Reading where a row's trek stands: a pull request's from its head as listed, as working out
// the change would fetch it first; none for a done trek's row, which says how its work ended.
function askOf(row: LandingRow, read: StatusOf): (() => Promise<TrekStatus>) | undefined {
  const { choice, pull } = row
  if (choice.kind === "trek") {
    return undefined
  }

  if (choice.kind === "pull-request") {
    return pull === undefined ? undefined : () => read.pullStatus(pull)
  }

  return () => read.status(choice)
}

// Whether a row's trek state is read on the landing page.
const workedOut = (row: LandingRow) =>
  row.choice.kind !== "trek" && (row.choice.kind !== "pull-request" || row.pull !== undefined)

/** The key of the row a change is listed on, whatever repos are ticked to go with it. */
export function choiceKey(choice: ChangeChoice): string {
  const { repos: _repos, ...change } = choice
  return JSON.stringify(change)
}

/** Whether every row whose trek's state is worked out here has its state yet. */
export const statesKnown = (
  rows: readonly LandingRow[],
  statuses: ReadonlyMap<string, TrekStatus>,
): boolean => rows.every((row) => !workedOut(row) || statuses.has(rowKey(row)))

/** Each row's trek status as it's worked out; one that can't be worked out is left blank. */
export function useStatuses(
  rows: readonly LandingRow[],
  { status, pullStatus }: StatusOf,
): ReadonlyMap<string, TrekStatus> {
  const [found, setFound] = useState<ReadonlyMap<string, TrekStatus>>(new Map())
  useEffect(() => {
    let current = true
    for (const row of rows) {
      const ask = askOf(row, { status, pullStatus })
      if (ask === undefined) {
        continue
      }

      void ask().then(
        (each) => current && setFound((known) => new Map(known).set(rowKey(row), each)),
        () => undefined,
      )
    }

    return () => {
      current = false
    }
  }, [rows, status, pullStatus])

  return found
}

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
const BUILT_KINDS: ReadonlySet<TrekStatus["kind"]> = new Set(["ready", "stale", "older-guide"])

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

const MARK_SEPARATOR = " · "

// What a row holds in the room a mark leaves it, the separator's room among it; given up whole
// where less than a character would show.
function fitBeside(detail: string, room: number): string {
  const left = detail === "" ? 0 : room - MARK_SEPARATOR.length
  return left < 2 ? "" : fit(detail, left)
}

// The table's columns: the names', what they hold, the states'.
type Widths = Readonly<{ name: number; detail: number; state: number; ages: boolean }>

// A row's name, as wide as it's drawn.
const nameText = (row: LandingRow) => indentOf(row) + row.label

// What a row holds and its mark, as wide as they're drawn.
const detailText = (row: LandingRow) =>
  [row.detail, row.mark ?? ""].filter(Boolean).join(MARK_SEPARATOR)

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
  const between = detail !== "" && mark !== "" ? MARK_SEPARATOR : ""
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

// A group's name, dim, at the page's left, its rows set in under it, and what it says of a group
// with nothing in it: "pull requests  none"; a blank line before it but the first.
function Heading(props: { group: LandingGroup; first: boolean; note?: LandingNote | undefined }) {
  const tones = useTones()
  const { note } = props

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {!props.first && <text fg={COLOUR.text}> </text>}
      <text fg={tones.dim}>
        {props.group}
        {note !== undefined && <span fg={tones[note.tone]}>{`${GAP}${note.text}`}</span>}
      </text>
    </box>
  )
}

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
}) {
  const { width } = useTerminalDimensions()
  const turning = useTurning(busy(items, statuses, opening))
  const now = useNow()
  const built = (name: string) => {
    const at = builtAt.get(name)
    return at === undefined ? undefined : shortAge(at, now)
  }
  const cells = cellsOf(items, statuses, opening, turning, built)
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
              <Heading group={item.group} first={index === start && noteAt !== index} />
            )}
            <Selectable selected={index === chosen} tint={tint} indent={ROW_INDENT}>
              <ChangeView
                row={item}
                cell={cells.get(rowKey(item)) ?? { text: "", tone: "dim" }}
                widths={widths}
                muted={muted}
              />
            </Selectable>
          </box>
        )
      })}
      {noteAt === items.length && <Note note={note} first={items.length === 0} />}
    </box>
  )
}

// An item under a different heading from the one before it, or the first.
const startsGroup = (previous: LandingRow | undefined, item: LandingRow) =>
  previous === undefined || previous.group !== item.group

// The note on the pull requests, with none to list yet, goes where they would: after own work.
function noteIndex(items: readonly LandingRow[]): number {
  const after = items.findIndex((item) => item.group !== "your work")
  return after === -1 ? items.length : after
}

/**
 * Where each item's lines start, its heading and the note above it among them, and where its own
 * line is.
 */
function linesOf(items: readonly LandingRow[], noteAt: number, hasNote: boolean) {
  const tops: number[] = []
  const own: number[] = []
  let line = 0
  for (const [index, item] of items.entries()) {
    tops.push(line)
    if (index === noteAt && hasNote) {
      line += index === 0 ? 1 : 2
    }

    if (startsGroup(items[index - 1], item)) {
      line += index === 0 && noteAt !== 0 ? 1 : 2
    }

    own.push(line)
    line += 1
  }

  return { tops, own, total: line }
}

/** The first item drawn, so the selected one sits mid-list where the list runs past `height`. */
function firstShown(
  items: readonly LandingRow[],
  chosen: number,
  noteAt: number,
  hasNote: boolean,
  height: number,
): number {
  const { tops, own, total } = linesOf(items, noteAt, hasNote)
  if (total <= height) {
    return 0
  }

  const top = Math.min(Math.max((own[chosen] ?? 0) - Math.floor(height / 2), 0), total - height)
  const found = tops.findIndex((line) => line >= top)
  let first = found === -1 ? 0 : Math.min(found, chosen)
  // a first line mid-group has its group's heading drawn over it, a line the count above leaves
  // out: on, while it would push the selected line past the bottom
  const below = (at: number) => (own[chosen] ?? 0) - (tops[at] ?? 0) + (headed(items, at) ? 0 : 1)
  while (first < chosen && below(first) >= height) {
    first += 1
  }

  return first
}

// Whether the line at `at` comes with its heading.
const headed = (items: readonly LandingRow[], at: number) => {
  const item = items[at]
  return item === undefined || startsGroup(items[at - 1], item)
}

function Note({ note, first }: { note: LandingNote | undefined; first: boolean }) {
  return note === undefined ? null : <Heading group={note.group} first={first} note={note} />
}
