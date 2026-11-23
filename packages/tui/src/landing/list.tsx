import type { RGBA } from "@opentui/core"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { LandingGroup, LandingRow } from "./rows"
import { statusBlock } from "../change/status-block"
import { Selectable } from "../ui/selectable"
import { STATE_LABELS } from "../ui/state-labels"
import { useTurning } from "../ui/turning"
import { fit } from "../ui/text"
import { COLOUR, type Tone, useTones } from "../ui/theme"

/** A line under a heading that isn't a change to open: still loading, none, or why not. */
export type LandingNote = Readonly<{ group: LandingGroup; text: string; tone: Tone }>

// The name and detail columns are as wide whatever's listed, so a row that arrives late, a pull
// request's long title, never moves the columns drawn already; longer is cut.
const NAME_WIDTH = 30
const DETAIL_WIDTH = 38

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

// The block's words read as the trek's state on a row; "ready" alone could be the branch.
const STATE_WORDS: Readonly<Record<string, string>> = {
  [STATE_LABELS.ready.state]: "trek ready",
  [STATE_LABELS.stale.state]: "trek stale",
}

// "● trek ready", "≠ trek stale", "○ no trek yet": in the words and colours a change's screen
// uses, or dimmed; code as it is says where finding its ways in stands.
function StatusView(props: {
  status: TrekStatus | undefined
  code: boolean
  asked: boolean
  muted: boolean
}) {
  const { status, code } = props
  const tones = useTones()
  // turning where it's being worked out; a pull request's isn't
  if (status === undefined) {
    return props.asked ? <WorkingOut /> : null
  }

  const { symbol, state, tone } = statusBlock(status, undefined, false, { code })
  return (
    <span
      fg={tones[props.muted ? "dim" : tone]}
    >{`  ${symbol} ${STATE_WORDS[state] ?? state}`}</span>
  )
}

// A change being opened, in its state's place: the busy symbol turning.
function Opening() {
  const tones = useTones()
  return <span fg={tones.busy}>{`  ${useTurning()} opening…`}</span>
}

// A trek's state being worked out: the busy symbol turning, dim, in the state's place.
function WorkingOut() {
  const tones = useTones()
  return <span fg={tones.dim}>{`  ${useTurning()}`}</span>
}

// One change to open: names lined up, what it holds dimmed after, then its trek's state; all of
// it dimmed while the sheet over the list has the keys.
function ChangeView({
  row,
  status,
  opening,
  muted,
}: {
  row: LandingRow
  status: TrekStatus | undefined
  // being opened, which its state's place says while it is
  opening: boolean
  muted: boolean
}) {
  const tones = useTones()

  return (
    <span>
      {"  "}
      <span {...(muted ? { fg: tones.dim } : {})}>
        {fit(row.label, NAME_WIDTH).padEnd(NAME_WIDTH)}
      </span>
      <span fg={tones.dim}>{`  ${fit(row.detail, DETAIL_WIDTH).padEnd(DETAIL_WIDTH)}`}</span>
      {opening ? (
        <Opening />
      ) : (
        <StatusView
          status={status}
          code={row.choice.kind === "code"}
          asked={quickChoice(row) !== undefined}
          muted={muted}
        />
      )}
    </span>
  )
}

function Heading(props: { group: LandingGroup; first: boolean }) {
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {!props.first && <text fg={COLOUR.text}> </text>}
      <text fg={tones.dim}>{props.group}</text>
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
  statuses,
  opening,
  muted,
}: {
  item: LandingItem
  statuses: ReadonlyMap<string, TrekStatus>
  opening: string | undefined
  muted: boolean
}) {
  const tones = useTones()
  if (item.kind === "done-fold") {
    return <span fg={tones.dim}>{`▸ DONE  ${String(item.count)}`}</span>
  }

  return (
    <ChangeView
      row={item.row}
      status={statuses.get(rowKey(item.row))}
      opening={rowKey(item.row) === opening}
      muted={muted}
    />
  )
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
  const noteAt = noteIndex(items)
  const start = firstShown(items, chosen, noteAt, note !== undefined, height)

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {items.slice(start).map((item, shown) => {
        const index = start + shown
        return (
          <box key={itemKey(item)} flexDirection="column" style={{ flexShrink: 0 }}>
            {index === noteAt && <Note note={note} first={index === 0} />}
            {(startsGroup(items[index - 1], item) ||
              (shown === 0 && item.kind !== "done-fold")) && (
              <Heading group={groupOf(item)} first={index === start && noteAt !== index} />
            )}
            {item.kind === "done-fold" && <text> </text>}
            <Selectable selected={index === chosen} tint={tint}>
              <ItemView item={item} statuses={statuses} opening={opening} muted={muted} />
            </Selectable>
          </box>
        )
      })}
      {noteAt === items.length && <Note note={note} first={items.length === 0} />}
    </box>
  )
}

// An item under a different heading from the one before it, or the first; the done fold is its
// own heading.
const startsGroup = (previous: LandingItem | undefined, item: LandingItem) =>
  item.kind !== "done-fold" && (previous === undefined || groupOf(previous) !== groupOf(item))

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
      line += index === 0 ? 2 : 3
    }

    if (startsGroup(items[index - 1], item)) {
      line += index === 0 && noteAt !== 0 ? 1 : 2
    }

    line += item.kind === "done-fold" ? 1 : 0
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

// Whether the line at `at` comes with its heading, or is the done fold, a heading of its own.
const headed = (items: readonly LandingItem[], at: number) => {
  const item = items[at]
  return item === undefined || item.kind === "done-fold" || startsGroup(items[at - 1], item)
}

function Note({ note, first }: { note: LandingNote | undefined; first: boolean }) {
  const tones = useTones()
  if (note === undefined) {
    return null
  }

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      <Heading group={note.group} first={first} />
      <text fg={tones[note.tone]}>{`    ${note.text}`}</text>
    </box>
  )
}
