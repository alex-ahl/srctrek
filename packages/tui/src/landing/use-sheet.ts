import type { NearbyCheckout } from "@srctrek/core"
import { useState } from "react"
import { type RepoItem, type Ticked, repoItems } from "./repos"
import { keyAt, selectedIndex } from "../ui/selection"
import { sheetKey } from "./sheet"
import { type DropKey, typed } from "./use-drop"
import type { KeyHint } from "../ui/footer"
import { stepped } from "../ui/move"

// A repo whose name or path holds what's typed, whatever its case.
const matches = (item: RepoItem, query: string) =>
  [item.checkout.name, item.checkout.path].some((text) =>
    text.toLowerCase().includes(query.toLowerCase()),
  )

const tickHint = (repo: RepoItem | undefined): KeyHint[] =>
  repo === undefined
    ? []
    : [{ key: "space", does: repo.pick === undefined ? "add repo" : "remove repo" }]

// The keys for the sheet: typing, the selected repo's, and esc, which clears what's typed first.
function sheetKeys(repo: RepoItem | undefined, query: string): KeyHint[] {
  const branches = repo === undefined ? [] : [{ key: "→", does: "branches" }]
  return [
    { key: "type", does: "narrow" },
    ...tickHint(repo),
    ...branches,
    { key: "esc", does: query === "" ? "done" : "clear" },
  ]
}

/**
 * The sheet of repos beside this one: whether it's open, the repos it lists, narrowed to what's
 * typed, the one selected, and its keys while it's open. Space hands the selected repo to
 * `onTick`, → to `onBranches`; letters are typed, as in a repo's branches.
 */
export function useSheet(
  checkouts: readonly NearbyCheckout[],
  ticked: Ticked,
  onTick: (checkout: NearbyCheckout) => void,
  onBranches: (path: string) => void,
) {
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState("")

  const items = repoItems(checkouts, ticked).filter((item) => matches(item, query))
  const at = selectedIndex(items, chosen, sheetKey)
  const repo = items[at]

  const close = () => {
    setOpen(false)
    setQuery("")
  }
  const move = (by: number) => setChosen(keyAt(items, stepped(at, by, items.length), sheetKey))
  const actions = new Map([
    ["escape", () => (query === "" ? close() : setQuery(""))],
    ["backspace", () => setQuery((now) => now.slice(0, -1))],
    ["space", () => repo !== undefined && onTick(repo.checkout)],
    ["right", () => repo !== undefined && onBranches(repo.checkout.path)],
    ["down", () => move(1)],
    ["up", () => move(-1)],
  ])

  /** Handles a key while the sheet is open, taking every one; false when it's closed. */
  const key = (pressed: DropKey): boolean => {
    if (!open) {
      return false
    }

    const action = actions.get(pressed.name)
    if (action !== undefined) {
      action()
    } else if (typed(pressed)) {
      setQuery((now) => now + (pressed.sequence ?? ""))
    }

    return true
  }

  return {
    open,
    show: () => setOpen(true),
    items,
    at,
    query,
    key,
    keys: sheetKeys(repo, query),
  }
}
