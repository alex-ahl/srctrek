import type { RGBA } from "@opentui/core"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import { DropLines, type DropView } from "./drop-view"
import { type FoldItem, type RepoItem, repoBranch, repoNotes } from "./repos"
import type { LandingGroup, LandingRow } from "./rows"
import { statusBlock } from "../change/status-block"
import { Selectable } from "../ui/selectable"
import { STATE_LABELS } from "../ui/state-labels"
import { useTurning } from "../ui/turning"
import { count, fit } from "../ui/text"
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
// uses; code as it is says where finding its ways in stands.
function StatusView(props: { status: TrekStatus | undefined; code: boolean; asked: boolean }) {
  const { status, code } = props
  const tones = useTones()
  // turning where it's being worked out; a pull request's isn't
  if (status === undefined) {
    return props.asked ? <WorkingOut /> : null
  }

  const { symbol, state, tone } = statusBlock(status, undefined, false, { code })
  return <span fg={tones[tone]}>{`  ${symbol} ${STATE_WORDS[state] ?? state}`}</span>
}

// A trek's state being worked out: the busy symbol turning, dim, in the state's place.
function WorkingOut() {
  const tones = useTones()
  return <span fg={tones.dim}>{`  ${useTurning()}`}</span>
}

// The columns, as wide as their longest, so what follows them lines up.
type Widths = Readonly<{ name: number; detail: number; repo: number; path: number }>

// One change to open: names lined up, what it holds dimmed after, then its trek's state.
function ChangeView({
  row,
  widths,
  status,
}: {
  row: LandingRow
  widths: Widths
  status: TrekStatus | undefined
}) {
  const tones = useTones()

  return (
    <span>
      {"  "}
      <span>{fit(row.label, widths.name).padEnd(widths.name)}</span>
      <span fg={tones.dim}>{`  ${fit(row.detail, widths.detail).padEnd(widths.detail)}`}</span>
      <StatusView
        status={status}
        code={row.choice.kind === "code"}
        asked={quickChoice(row) !== undefined}
      />
    </span>
  )
}

function Heading({ group, first }: { group: LandingGroup; first: boolean }) {
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {!first && <text fg={COLOUR.text}> </text>}
      <text fg={tones.dim}>{group}</text>
    </box>
  )
}

/** The done treks folded under their heading and a count, until opened. */
export type DoneFoldItem = Readonly<{ kind: "done-fold"; count: number }>

/**
 * Something the landing page lists: a change to open, a repo beside this one, the folded rest of
 * them, or the folded done treks.
 */
export type LandingItem =
  Readonly<{ kind: "change"; row: LandingRow }> | RepoItem | FoldItem | DoneFoldItem

function groupOf(item: LandingItem): LandingGroup {
  if (item.kind === "change") {
    return item.row.group
  }

  return item.kind === "done-fold" ? "DONE" : "MORE REPOS"
}

/** The item's key, which keeps it selected while the lines around it come and go. */
export function itemKey(item: LandingItem): string {
  if (item.kind === "change") {
    return rowKey(item.row)
  }

  return item.kind === "repo" ? `repo:${item.checkout.path}` : item.kind
}

// A repo beside this one: ticked or not, its name and path, its branch, with → to open its
// branches on the selected row (▾ while they're open), and what it holds.
function RepoView({
  item,
  selected,
  open,
  widths,
}: {
  item: RepoItem
  selected: boolean
  open: boolean
  widths: Widths
}) {
  const tones = useTones()
  const ticked = item.pick !== undefined
  const notes = repoNotes(item)
  const arrow = open ? " ▾" : " ▸"

  return (
    <span>
      <span fg={ticked ? tones.accent : tones.dim}>{ticked ? "[x] " : "[ ] "}</span>
      <span>{item.checkout.name.padEnd(widths.repo)}</span>
      <span fg={tones.dim}>{`  ${item.checkout.path.padEnd(widths.path)}  `}</span>
      <span>{repoBranch(item)}</span>
      {(selected || open) && <span fg={tones.accent}>{arrow}</span>}
      {notes !== "" && <span fg={tones.dim}>{`  ${notes}`}</span>}
    </span>
  )
}

function ItemView({
  item,
  selected,
  open,
  widths,
  statuses,
}: {
  item: LandingItem
  selected: boolean
  open: boolean
  widths: Widths
  statuses: ReadonlyMap<string, TrekStatus>
}) {
  const tones = useTones()
  if (item.kind === "fold") {
    return <span fg={tones.dim}>{`▸ ${count(item.count, "more repo")}`}</span>
  }

  if (item.kind === "done-fold") {
    return <span fg={tones.dim}>{`▸ DONE  ${String(item.count)}`}</span>
  }

  if (item.kind === "repo") {
    return <RepoView item={item} selected={selected} open={open} widths={widths} />
  }

  return <ChangeView row={item.row} widths={widths} status={statuses.get(rowKey(item.row))} />
}

/**
 * Everything to open under its heading, the selected line on the tint; the note on what waits on
 * the user's review, for when there's none to open yet, sits where it would.
 */
export function LandingList({
  items,
  chosen,
  statuses,
  note,
  drop,
  tint,
  height,
}: {
  items: readonly LandingItem[]
  chosen: number
  statuses: ReadonlyMap<string, TrekStatus>
  note: LandingNote | undefined
  // a repo's branches open under its row
  drop: DropView | undefined
  tint: RGBA | undefined
  // the lines there's room for
  height: number
}) {
  const widths = widthsOf(items)
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
            <Selectable selected={index === chosen && drop === undefined} tint={tint}>
              <ItemView
                item={item}
                selected={index === chosen}
                open={isOpen(item, drop)}
                widths={widths}
                statuses={statuses}
              />
            </Selectable>
            {drop !== undefined && isOpen(item, drop) && <DropLines view={drop} tint={tint} />}
          </box>
        )
      })}
      {noteAt === items.length && <Note note={note} first={items.length === 0} />}
    </box>
  )
}

// The repo whose branches are open under it.
const isOpen = (item: LandingItem, drop: DropView | undefined) =>
  item.kind === "repo" && item.checkout.path === drop?.drop.path

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
 * line is; a repo's open branches are left out, as they open under the selection.
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
  const first = tops.findIndex((line) => line >= top)
  return first === -1 ? 0 : Math.min(first, chosen)
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

// The changes' columns as wide as they always are; the repos' names and paths as wide as their
// longest, lined up among themselves.
function widthsOf(items: readonly LandingItem[]): Widths {
  const repos = items.flatMap((item) => (item.kind === "repo" ? [item.checkout] : []))

  return {
    name: NAME_WIDTH,
    detail: DETAIL_WIDTH,
    repo: Math.max(0, ...repos.map((repo) => repo.name.length)),
    path: Math.max(0, ...repos.map((repo) => repo.path.length)),
  }
}
