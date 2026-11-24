import { type RGBA, TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/react"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { LandingGroup, LandingRow } from "./rows"
import { statusBlock } from "../change/status-block"
import { PADDING } from "../ui/layout"
import { Selectable } from "../ui/selectable"
import { useTurning } from "../ui/turning"
import { count, fit } from "../ui/text"
import { COLOUR, type Tone, useTones } from "../ui/theme"

/** What a heading says of a group with nothing to open in it: still loading, none, or why not. */
export type LandingNote = Readonly<{ group: LandingGroup; text: string; tone: Tone }>

// Names are cut past this share of the width, so one long title can't push every row's details
// far from its name.
const NAME_SHARE = 0.4

// The selection marker's room, and the gap between columns.
const MARKER = 2
const GAP = "  "

const rowKey = (row: LandingRow) => JSON.stringify(row.choice)

// Working out a pull request's trek means fetching it first, too slow to do for each row; a done
// trek's row says how its work ended instead.
function quickChoice(row: LandingRow): ChangeChoice | undefined {
  const { choice } = row
  return choice.kind === "pull-request" || choice.kind === "trek" ? undefined : choice
}

/** The key of the row a change is listed on, whatever repos are ticked to go with it. */
export function choiceKey(choice: ChangeChoice): string {
  const { repos: _repos, ...change } = choice
  return JSON.stringify(change)
}

/** Whether every row whose trek's state is worked out here has its state yet. */
export const statesKnown = (
  rows: readonly LandingRow[],
  statuses: ReadonlyMap<string, TrekStatus>,
): boolean => rows.every((row) => quickChoice(row) === undefined || statuses.has(rowKey(row)))

/** Each row's trek status as it's worked out; one that can't be worked out is left blank. */
export function useStatuses(
  rows: readonly LandingRow[],
  status: (choice: ChangeChoice) => Promise<TrekStatus>,
): ReadonlyMap<string, TrekStatus> {
  const [found, setFound] = useState<ReadonlyMap<string, TrekStatus>>(new Map())
  useEffect(() => {
    let current = true
    for (const row of rows) {
      const choice = quickChoice(row)
      if (choice === undefined) {
        continue
      }

      void status(choice).then(
        (each) => current && setFound((known) => new Map(known).set(rowKey(row), each)),
        () => undefined,
      )
    }

    return () => {
      current = false
    }
  }, [rows, status])

  return found
}

// Code as it is in a row's first column; "ways in" is in its name.
const STATE_WORDS: Readonly<Record<string, string>> = {
  "ways in not found yet": "not found yet",
}

// Where a row's trek isn't worked out here, holding its place so the column has no holes.
const NOT_WORKED_OUT = "·"

// The opening state's text, which the column always has room for.
const OPENING = "◐ opening…"

/** A row's trek state as its first column words it, and the tone it's drawn in. */
type StateCell = Readonly<{ text: string; tone: Tone }>

// "● ready", "≠ stale", "○ no trek yet": in the words and colours a change's screen uses; code
// as it is says where finding its ways in stands; turning while being opened or worked out; a dot
// for a pull request's or a done trek's, not worked out here.
function stateCell(
  row: LandingRow,
  status: TrekStatus | undefined,
  opening: boolean,
  turning: string,
): StateCell {
  if (opening) {
    return { text: `${turning} opening…`, tone: "busy" }
  }

  if (status === undefined) {
    return { text: quickChoice(row) === undefined ? NOT_WORKED_OUT : turning, tone: "dim" }
  }

  const { symbol, state, tone } = statusBlock(status, undefined, false, {
    code: row.choice.kind === "code",
  })
  return { text: `${symbol} ${STATE_WORDS[state] ?? state}`, tone }
}

// The states' column, where names are cut, and the room a row has after the selection marker.
type Widths = Readonly<{ state: number; name: number; room: number }>

// One change to open: its trek's state first, then its name, and right after it what it holds,
// dimmed; all of it dimmed while the sheet over the list has the keys.
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
  const name = fit(row.label, widths.name)
  const left = widths.room - widths.state - name.length - 2 * GAP.length

  return (
    <span>
      <span fg={tones[muted ? "dim" : cell.tone]}>{cell.text.padEnd(widths.state)}</span>
      {GAP}
      <span {...(muted ? { fg: tones.dim } : {})}>{name}</span>
      <span fg={tones.dim}>{`${GAP}${fit(row.detail, Math.max(left, 0))}`}</span>
    </span>
  )
}

// A group's heading, bold, and what it says of a group with nothing in it.
function Heading(props: { group: LandingGroup; first: boolean; note?: LandingNote | undefined }) {
  const tones = useTones()
  const { note } = props

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {!props.first && <text fg={COLOUR.text}> </text>}
      <text fg={COLOUR.text}>
        <span attributes={TextAttributes.BOLD}>{props.group}</span>
        {note !== undefined && <span fg={tones[note.tone]}>{`${GAP}${note.text}`}</span>}
      </text>
    </box>
  )
}

/** The done treks folded under their heading and a count, until opened. */
export type DoneFoldItem = Readonly<{ kind: "done-fold"; count: number }>

/** Something the landing page lists: a change to open, or the folded done treks. */
export type LandingItem = Readonly<{ kind: "change"; row: LandingRow }> | DoneFoldItem

const groupOf = (item: LandingItem): LandingGroup =>
  item.kind === "change" ? item.row.group : "DONE"

/** The item's key, which keeps it selected while the lines around it come and go. */
export const itemKey = (item: LandingItem): string =>
  item.kind === "change" ? rowKey(item.row) : item.kind

function ItemView({
  item,
  cells,
  widths,
  muted,
}: {
  item: LandingItem
  cells: ReadonlyMap<string, StateCell>
  widths: Widths
  muted: boolean
}) {
  const tones = useTones()
  if (item.kind === "done-fold") {
    return <span fg={tones.dim}>{`▸ ${count(item.count, "trek")}`}</span>
  }

  const cell = cells.get(rowKey(item.row)) ?? { text: "", tone: "dim" }
  return <ChangeView row={item.row} cell={cell} widths={widths} muted={muted} />
}

// Whether a row's state is turning: a change being opened, or one still being worked out.
const busy = (
  items: readonly LandingItem[],
  statuses: ReadonlyMap<string, TrekStatus>,
  opening: string | undefined,
) =>
  opening !== undefined ||
  items.some(
    (item) =>
      item.kind === "change" &&
      quickChoice(item.row) !== undefined &&
      !statuses.has(rowKey(item.row)),
  )

// Each row's state cell, by its key.
function cellsOf(
  items: readonly LandingItem[],
  statuses: ReadonlyMap<string, TrekStatus>,
  opening: string | undefined,
  turning: string,
): ReadonlyMap<string, StateCell> {
  const rows = items.flatMap((item) => (item.kind === "change" ? [item.row] : []))
  return new Map(
    rows.map((row) => {
      const key = rowKey(row)
      return [key, stateCell(row, statuses.get(key), key === opening, turning)]
    }),
  )
}

// The states' column as wide as the longest, room for opening one kept; names cut past their
// share of the row.
function widthsOf(cells: ReadonlyMap<string, StateCell>, width: number): Widths {
  const room = width - 2 * PADDING - MARKER
  const state = Math.max(OPENING.length, ...[...cells.values()].map((cell) => cell.text.length))

  return { state, name: Math.floor(room * NAME_SHARE), room }
}

/**
 * Everything to open under its heading, the selected line on the tint; the note on what waits on
 * the user's review, for when there's none to open yet, sits where it would.
 */
export function LandingList({
  items,
  chosen,
  statuses,
  opening,
  note,
  muted,
  tint,
  height,
}: {
  items: readonly LandingItem[]
  chosen: number
  statuses: ReadonlyMap<string, TrekStatus>
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
  const cells = cellsOf(items, statuses, opening, turning)
  const widths = widthsOf(cells, width)
  const noteAt = noteIndex(items)
  const start = firstShown(items, chosen, noteAt, note !== undefined, height)

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {items.slice(start).map((item, shown) => {
        const index = start + shown
        return (
          <box key={itemKey(item)} flexDirection="column" style={{ flexShrink: 0 }}>
            {index === noteAt && <Note note={note} first={index === 0} />}
            {(startsGroup(items[index - 1], item) || shown === 0) && (
              <Heading group={groupOf(item)} first={index === start && noteAt !== index} />
            )}
            <Selectable selected={index === chosen} tint={tint}>
              <ItemView item={item} cells={cells} widths={widths} muted={muted} />
            </Selectable>
          </box>
        )
      })}
      {noteAt === items.length && <Note note={note} first={items.length === 0} />}
    </box>
  )
}

// An item under a different heading from the one before it, or the first.
const startsGroup = (previous: LandingItem | undefined, item: LandingItem) =>
  previous === undefined || groupOf(previous) !== groupOf(item)

// The note on what waits on the user's review goes where those would: after their own work.
function noteIndex(items: readonly LandingItem[]): number {
  const after = items.findIndex((item) => groupOf(item) !== "YOUR WORK")
  return after === -1 ? items.length : after
}

/**
 * Where each item's lines start, its heading and the note above it among them, and where its own
 * line is.
 */
function linesOf(items: readonly LandingItem[], noteAt: number, hasNote: boolean) {
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
  items: readonly LandingItem[],
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
const headed = (items: readonly LandingItem[], at: number) => {
  const item = items[at]
  return item === undefined || startsGroup(items[at - 1], item)
}

function Note({ note, first }: { note: LandingNote | undefined; first: boolean }) {
  return note === undefined ? null : <Heading group={note.group} first={first} note={note} />
}
