import { type RGBA, TextAttributes } from "@opentui/core"
import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { type ReactNode, useEffect, useState } from "react"
import { type FoldItem, type RepoItem, repoDetail } from "./change-picker-repos"
import { type PickerGroup, type PickerRow, sameChange } from "./change-picker-rows"
import { statusBlock } from "./status-block"
import { count, fit } from "./text"
import { COLOUR, type Tone, useTones } from "./theme"

/** A line under a heading that isn't a change to pick: still loading, none, or why not. */
export type PickerNote = Readonly<{ group: PickerGroup; text: string; tone: Tone }>

// A pull request's title can run long; past this, names are cut so the columns stay put.
const MAX_NAME_WIDTH = 44

const rowKey = (row: PickerRow) => JSON.stringify(row.choice)

// Working out a pull request's trek means fetching it first, too slow to do for each row.
const hasQuickStatus = (row: PickerRow) => row.choice.kind !== "pull-request"

/** Each row's trek status as it's worked out; one that can't be worked out is left blank. */
export function useStatuses(
  rows: readonly PickerRow[],
  status: (choice: ChangeChoice) => Promise<TrekStatus>,
): ReadonlyMap<string, TrekStatus> {
  const [found, setFound] = useState<ReadonlyMap<string, TrekStatus>>(new Map())
  useEffect(() => {
    let current = true
    for (const row of rows.filter(hasQuickStatus)) {
      void status(row.choice).then(
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
  ready: "trek ready",
  stale: "trek stale",
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
type Widths = Readonly<{ name: number; detail: number; path: number }>

// One change to pick: the current one marked, names lined up, what it holds dimmed after.
function ChangeView({
  row,
  current,
  widths,
  status,
}: {
  row: PickerRow
  current: boolean
  widths: Widths
  status: TrekStatus | undefined
}) {
  const tones = useTones()

  return (
    <span>
      <span fg={tones.accent}>{current ? "● " : "  "}</span>
      <span {...(current ? { attributes: TextAttributes.BOLD } : {})}>
        {fit(row.label, widths.name).padEnd(widths.name)}
      </span>
      <span fg={tones.dim}>{`  ${row.detail.padEnd(widths.detail)}`}</span>
      <StatusView status={status} />
    </span>
  )
}

function Heading({ group, first }: { group: PickerGroup; first: boolean }) {
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {!first && <text fg={COLOUR.text}> </text>}
      <text fg={tones.dim}>{group}</text>
    </box>
  )
}

/** Something the picker lists: a change to pick, a repo beside this one, or the folded rest. */
export type PickerItem = Readonly<{ kind: "change"; row: PickerRow }> | RepoItem | FoldItem

const groupOf = (item: PickerItem): PickerGroup =>
  item.kind === "change" ? item.row.group : "MORE REPOS"

function itemKey(item: PickerItem): string {
  if (item.kind === "change") {
    return rowKey(item.row)
  }

  return item.kind === "repo" ? `repo:${item.checkout.path}` : "fold"
}

// The selected line on the tint, or marked where the terminal's colours aren't known.
function Selectable({
  selected,
  tint,
  children,
}: {
  selected: boolean
  tint: RGBA | undefined
  children: ReactNode
}) {
  const tones = useTones()
  const marked = selected && tint === undefined
  const line = (
    <text fg={COLOUR.text}>
      <span fg={tones.accent}>{marked ? "▶ " : "  "}</span>
      {children}
    </text>
  )

  return selected && tint !== undefined ? <box style={{ backgroundColor: tint }}>{line}</box> : line
}

// A repo beside this one: ticked or not, its name, then its path and what it has checked out.
function RepoView({ item, widths }: { item: RepoItem; widths: Widths }) {
  const tones = useTones()
  const ticked = item.pick !== undefined

  return (
    <span>
      <span fg={ticked ? tones.accent : tones.dim}>{ticked ? "[x] " : "[ ] "}</span>
      <span>{fit(item.checkout.name, widths.name - 2).padEnd(widths.name - 2)}</span>
      <span
        fg={tones.dim}
      >{`  ${item.checkout.path.padEnd(widths.path)}  ${repoDetail(item)}`}</span>
    </span>
  )
}

function ItemView({
  item,
  choice,
  widths,
  statuses,
}: {
  item: PickerItem
  choice: ChangeChoice
  widths: Widths
  statuses: ReadonlyMap<string, TrekStatus>
}) {
  const tones = useTones()
  if (item.kind === "fold") {
    return <span fg={tones.dim}>{`▸ ${count(item.count, "more repo")}`}</span>
  }

  if (item.kind === "repo") {
    return <RepoView item={item} widths={widths} />
  }

  return (
    <ChangeView
      row={item.row}
      current={sameChange(item.row.choice, choice)}
      widths={widths}
      status={statuses.get(rowKey(item.row))}
    />
  )
}

/**
 * Everything to pick under its heading, the selected line on the tint, the current change marked
 * with a dot; the pull requests' note, for when there are none to pick yet, sits where they would.
 */
export function PickerList({
  items,
  chosen,
  choice,
  statuses,
  note,
  tint,
}: {
  items: readonly PickerItem[]
  chosen: number
  choice: ChangeChoice
  statuses: ReadonlyMap<string, TrekStatus>
  note: PickerNote | undefined
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
          <Selectable selected={index === chosen} tint={tint}>
            <ItemView item={item} choice={choice} widths={widths} statuses={statuses} />
          </Selectable>
        </box>
      ))}
      {noteAt === items.length && <Note note={note} first={items.length === 0} />}
    </box>
  )
}

// An item under a different heading from the one before it, or the first.
const startsGroup = (previous: PickerItem | undefined, item: PickerItem) =>
  previous === undefined || groupOf(previous) !== groupOf(item)

// The pull requests' note goes before the repos, or at the end when there are none.
function noteIndex(items: readonly PickerItem[]): number {
  const repos = items.findIndex((item) => item.kind !== "change")
  return repos === -1 ? items.length : repos
}

function Note({ note, first }: { note: PickerNote | undefined; first: boolean }) {
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

// Names, repo paths, and details as wide as their longest, so later columns line up.
function widthsOf(items: readonly PickerItem[]): Widths {
  const rows = items.flatMap((item) => (item.kind === "change" ? [item.row] : []))
  const repos = items.flatMap((item) => (item.kind === "repo" ? [item.checkout] : []))
  const names = [
    ...rows.map((row) => row.label.length),
    ...repos.map((repo) => repo.name.length + 2),
  ]

  return {
    name: Math.min(MAX_NAME_WIDTH, Math.max(0, ...names)),
    detail: Math.max(0, ...rows.map((row) => row.detail.length)),
    path: Math.max(0, ...repos.map((repo) => repo.path.length)),
  }
}
