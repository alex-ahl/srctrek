import type { TrekStatus } from "@srctrek/core"
import { type Item, type ListLine, itemKey } from "./list/lines"
import { type SectionId } from "./list/sections"
import { hasTrek } from "./states"
import type { Action } from "./row-actions"

// "3–22 of 35": which items are on screen, when not all of them are.
export function shownItems(visible: readonly ListLine[], total: number): string {
  const indexes = visible.flatMap((line) => (line.kind === "item" ? [line.index] : []))
  const [first, last] = [indexes.at(0), indexes.at(-1)]
  if (first === undefined || last === undefined || indexes.length === total) {
    return ""
  }

  return `${first + 1}–${last + 1} of ${total}`
}

// The section opened if closed, closed if open.
export function toggled(open: ReadonlySet<SectionId>, id: SectionId): ReadonlySet<SectionId> {
  return open.has(id) ? new Set([...open].filter((each) => each !== id)) : new Set([...open, id])
}

// Until the user moves, your changes are picked out: their trek once it's listed, else their own
// row; else the first.
export function defaultKey(
  items: readonly Item[],
  status: TrekStatus | undefined,
): string | undefined {
  const change = hasTrek(status) ? `trek:${status?.name}` : undefined
  const keys = items.map(itemKey)

  return keys.find((key) => key === change || key === "change") ?? keys[0]
}

// Which item is selected: the one the user chose while it's still listed, else the default.
export function selectedIndex(
  items: readonly Item[],
  chosen: string | undefined,
  status: TrekStatus | undefined,
) {
  const keys = items.map(itemKey)
  const found = chosen === undefined ? -1 : keys.indexOf(chosen)
  if (found !== -1) {
    return found
  }

  return Math.max(0, keys.indexOf(defaultKey(items, status) ?? ""))
}

// What enter does: open or close a fold, else what it does on the row.
export function pickFor(
  item: Item | undefined,
  onRow: Action,
  fold: (id: SectionId) => void,
): Action {
  if (item?.kind !== "fold") {
    return onRow
  }

  const { id } = item.section
  return () => fold(id)
}

// A key on the list: E, S, or C, with shift, opens the editor picker, settings, or the change
// picker; any other does its action.
export function listKey(
  key: { name: string; shift: boolean },
  actions: ReadonlyMap<string, () => void>,
  shifted: ReadonlyMap<string, () => void>,
) {
  const action = key.shift ? shifted.get(key.name) : actions.get(key.name)
  action?.()
}
