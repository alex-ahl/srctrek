import type { Row } from "./rows"
import { FOLDING, type Section, type SectionId } from "./sections"

/**
 * What can be selected in the home screen's list: a row, or a folding section's heading, which
 * enter opens or closes.
 */
export type Item = { kind: "row"; row: Row } | { kind: "fold"; section: Section; open: boolean }

/** A line of the list: a section's heading, the gap before it, or an item that can be selected. */
export type ListLine =
  { kind: "heading"; text: string } | { kind: "gap" } | { kind: "item"; item: Item; index: number }

// A section's lines before its items are numbered: its heading, or the fold that stands for it,
// then its rows unless it's folded.
function sectionLines(section: Section, open: ReadonlySet<SectionId>): (ListLine | Item)[] {
  const rows = section.rows.map((row): Item => ({ kind: "row", row }))
  if (!FOLDING.has(section.id)) {
    return [{ kind: "heading", text: section.title }, ...rows]
  }

  const isOpen = open.has(section.id)
  return [{ kind: "fold", section, open: isOpen }, ...(isOpen ? rows : [])]
}

const isItem = (line: ListLine | Item): line is Item => line.kind === "row" || line.kind === "fold"

/** The sections as lines, a gap between each, with every item numbered in order. */
export function listLines(sections: readonly Section[], open: ReadonlySet<SectionId>): ListLine[] {
  const lines = sections.flatMap((section, i) => [
    ...(i === 0 ? [] : [{ kind: "gap" as const }]),
    ...sectionLines(section, open),
  ])

  let index = 0
  return lines.map((line) => (isItem(line) ? { kind: "item", item: line, index: index++ } : line))
}

/** The items, in order. */
export function itemsOf(lines: readonly ListLine[]): Item[] {
  return lines.flatMap((line) => (line.kind === "item" ? [line.item] : []))
}

/** Where the item at `index` sits among the lines. */
export function lineOfItem(lines: readonly ListLine[], index: number): number {
  return Math.max(
    0,
    lines.findIndex((line) => line.kind === "item" && line.index === index),
  )
}

/** The key an item is known by, so the selection stays on it as rows move between sections. */
export function itemKey(item: Item): string {
  if (item.kind === "fold") {
    return `fold:${item.section.id}`
  }

  const { row } = item
  if (row.kind === "proposal") {
    return `proposal:${row.proposal.name}`
  }

  return row.kind === "trigger" ? `trigger:${row.found.trigger.name}` : `trek:${row.entry.name}`
}
