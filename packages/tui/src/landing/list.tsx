import type { RGBA } from "@opentui/core"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import { DropLines, type DropView } from "./drop-view"
import { type FoldItem, type RepoItem, repoBranch, repoNotes } from "./repos"
import type { LandingGroup, LandingRow } from "./rows"
import { statusBlock } from "../change/status-block"
import { Selectable } from "../ui/selectable"
import { STATE_LABELS } from "../ui/state-labels"
import { count, fit } from "../ui/text"
import { COLOUR, type Tone, useTones } from "../ui/theme"

/** A line under a heading that isn't a change to open: still loading, none, or why not. */
export type LandingNote = Readonly<{ group: LandingGroup; text: string; tone: Tone }>

// A pull request's title can run long; past this, names are cut so the columns stay put.
const MAX_NAME_WIDTH = 44

const rowKey = (row: LandingRow) => JSON.stringify(row.choice)

// Working out a pull request's trek means fetching it first, too slow to do for each row; a done
// trek's row says how its work ended instead.
function quickChoice(row: LandingRow): ChangeChoice | undefined {
  const { choice } = row
  return choice.kind === "pull-request" || choice.kind === "trek" ? undefined : choice
}

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

// "● trek ready", "≠ trek stale", "○ no trek yet": in the words and colours the home screen uses.
function StatusView({ status }: { status: TrekStatus | undefined }) {
  const tones = useTones()
  if (status === undefined) {
    return null
  }

  const { symbol, state, tone } = statusBlock(status, undefined, false)
  return <span fg={tones[tone]}>{`  ${symbol} ${STATE_WORDS[state] ?? state}`}</span>
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
      <span fg={tones.dim}>{`  ${row.detail.padEnd(widths.detail)}`}</span>
      <StatusView status={status} />
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
}: {
  items: readonly LandingItem[]
  chosen: number
  statuses: ReadonlyMap<string, TrekStatus>
  note: LandingNote | undefined
  // a repo's branches open under its row
  drop: DropView | undefined
  tint: RGBA | undefined
}) {
  const widths = widthsOf(items)
  const noteAt = noteIndex(items)

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {items.map((item, index) => (
        <box key={itemKey(item)} flexDirection="column" style={{ flexShrink: 0 }}>
          {index === noteAt && <Note note={note} first={index === 0} />}
          {startsGroup(items[index - 1], item) && (
            <Heading group={groupOf(item)} first={index === 0 && noteAt !== 0} />
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
      ))}
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

// Each column as wide as its longest: the changes' names and details, and the repos' names and
// paths, which line up among themselves rather than with a long pull request title above them.
function widthsOf(items: readonly LandingItem[]): Widths {
  const rows = items.flatMap((item) => (item.kind === "change" ? [item.row] : []))
  const repos = items.flatMap((item) => (item.kind === "repo" ? [item.checkout] : []))

  return {
    name: Math.min(MAX_NAME_WIDTH, Math.max(0, ...rows.map((row) => row.label.length))),
    detail: Math.max(0, ...rows.map((row) => row.detail.length)),
    repo: Math.max(0, ...repos.map((repo) => repo.name.length)),
    path: Math.max(0, ...repos.map((repo) => repo.path.length)),
  }
}
