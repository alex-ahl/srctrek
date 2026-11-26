import type { LandingRow } from "./rows"

/** An item under a different heading from the one before it, or the first. */
export const startsGroup = (previous: LandingRow | undefined, item: LandingRow) =>
  previous === undefined || previous.group !== item.group

/**
 * The note on the pull requests, with none to list yet, goes where they would: after what's
 * checked out.
 */
export function noteIndex(items: readonly LandingRow[]): number {
  const after = items.findIndex((item) => item.group !== "checked out")
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
export function firstShown(
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
