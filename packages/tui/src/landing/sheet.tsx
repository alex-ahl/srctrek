import type { RGBA } from "@opentui/core"
import { DropLines, type DropView, dropHeight } from "./drop-view"
import { type RepoItem, repoBranch, repoNotes } from "./repos"
import { PADDING } from "../ui/layout"
import { Selectable } from "../ui/selectable"
import { useTones } from "../ui/theme"

/** The sheet line's key, which keeps it selected as the repos are read again. */
export const sheetKey = (item: RepoItem): string => item.checkout.path

// The sheet's rule above, and its heading.
const SHEET_CHROME = 2

// The names' and paths' columns as wide as their longest, lined up among themselves.
type Widths = Readonly<{ repo: number; path: number }>

function widthsOf(items: readonly RepoItem[]): Widths {
  const repos = items.map((item) => item.checkout)
  return {
    repo: Math.max(0, ...repos.map((repo) => repo.name.length)),
    path: Math.max(0, ...repos.map((repo) => repo.path.length)),
  }
}

// The repo whose branches are open under it.
const isOpen = (item: RepoItem, drop: DropView | undefined) =>
  item.checkout.path === drop?.drop.path

const linesOf = (item: RepoItem, drop: DropView | undefined) =>
  drop !== undefined && isOpen(item, drop) ? 1 + dropHeight(drop) : 1

/** The first line drawn, so the selected one, its branches with it, fits in `room` lines. */
function firstShown(
  items: readonly RepoItem[],
  chosen: number,
  drop: DropView | undefined,
  room: number,
): number {
  let first = 0
  const shown = (from: number) =>
    items.slice(from, chosen + 1).reduce((lines, item) => lines + linesOf(item, drop), 0)
  while (first < chosen && shown(first) > room) {
    first += 1
  }

  return first
}

/** The lines the sheet takes: its rule and heading, and its lines up to `most` in all. */
export function sheetHeight(
  items: readonly RepoItem[],
  drop: DropView | undefined,
  most: number,
): number {
  const lines = items.reduce((total, item) => total + linesOf(item, drop), 0)
  return Math.min(SHEET_CHROME + lines, most)
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

/**
 * The repos beside this one, slid up from the bottom under the accent's rule: how many are added,
 * each ticked or not, a repo's branches open under it, the selected line on the tint.
 */
export function RepoSheet({
  items,
  chosen,
  drop,
  tint,
  height,
}: {
  items: readonly RepoItem[]
  chosen: number
  // a repo's branches open under its row
  drop: DropView | undefined
  tint: RGBA | undefined
  // the lines the sheet takes, its rule and heading among them
  height: number
}) {
  const tones = useTones()
  const widths = widthsOf(items)
  const added = items.filter((item) => item.pick !== undefined).length
  const start = firstShown(items, chosen, drop, height - SHEET_CHROME)

  return (
    <box
      flexDirection="column"
      border={["top"]}
      borderColor={tones.accent}
      style={{
        flexShrink: 0,
        height,
        overflow: "hidden",
        paddingLeft: PADDING,
        paddingRight: PADDING,
      }}
    >
      <box style={{ flexShrink: 0 }}>
        <text>
          <span fg={tones.accent}>ADD REPOS</span>
          <span fg={tones.dim}>{added === 0 ? "" : ` · ${String(added)} added`}</span>
        </text>
      </box>
      {items.slice(start).map((item, shown) => {
        const index = start + shown
        const open = isOpen(item, drop)
        return (
          <box key={sheetKey(item)} flexDirection="column" style={{ flexShrink: 0 }}>
            <Selectable selected={index === chosen && drop === undefined} tint={tint}>
              <RepoView item={item} selected={index === chosen} open={open} widths={widths} />
            </Selectable>
            {drop !== undefined && open && <DropLines view={drop} tint={tint} />}
          </box>
        )
      })}
    </box>
  )
}
