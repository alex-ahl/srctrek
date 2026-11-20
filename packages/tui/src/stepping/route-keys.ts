import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import { type RouteStop, insideOf } from "./route"
import { type Narrow, WHOLE, narrowed, shownOf } from "./route-narrow"

type MapKey = Readonly<{ name: string; sequence?: string; ctrl?: boolean; meta?: boolean }>

// A letter, digit, or sign typed into the find, not a key that does something.
const typed = (key: MapKey) =>
  key.ctrl !== true && key.meta !== true && key.sequence?.length === 1 && key.sequence >= " "

// Whether the call at `chosen` can fold: it leads somewhere, and the trek isn't inside it.
function foldable(route: readonly RouteStop[], chosen: number, at: number): boolean {
  const under = insideOf(route, chosen)
  return under > 0 && !(at > chosen && at <= chosen + under)
}

// While find is typed: letters add to it, backspace takes one off, enter keeps it, esc drops it.
function findKey(key: MapKey, narrow: Narrow): Narrow {
  if (key.name === "escape") {
    return { ...narrow, find: "", finding: false }
  }

  if (key.name === "return") {
    return { ...narrow, finding: false }
  }

  if (key.name === "backspace") {
    return { ...narrow, find: narrow.find.slice(0, -1) }
  }

  return typed(key) ? { ...narrow, find: narrow.find + (key.sequence ?? "") } : narrow
}

// c and f narrow to changed or flagged stops, again to show them all.
const only = (narrow: Narrow, to: "changed" | "flagged"): Narrow => ({
  ...narrow,
  only: narrow.only === to ? undefined : to,
})

type MapState = Readonly<{
  route: readonly RouteStop[]
  at: number
  folded: ReadonlySet<string>
  onFold: (id: string, folded: boolean) => void
  onGo: (id: string) => void
  onClose: () => void
}>

/**
 * The map's keys: ↑/↓ through the stops shown, ←/→ fold and unfold the chosen call, c and f
 * narrow to changed or flagged stops, / finds by name, esc undoes the narrowing before it closes,
 * tab lays it out by repo. The chosen stop is the first shown when the narrowing leaves it out.
 */
export function useMapKeys({ route, at, folded, onFold, onGo, onClose }: MapState) {
  const [picked, setChosen] = useState(at)
  const [byRepo, setByRepo] = useState(false)
  const [narrow, setNarrow] = useState<Narrow>(WHOLE)
  const shown = shownOf(route, folded, narrow)
  const chosen = shown.includes(picked) ? picked : (shown[0] ?? picked)
  const step = (by: 1 | -1) => setChosen(shown[shown.indexOf(chosen) + by] ?? chosen)
  const fold = (on: boolean) => {
    const stop = route[chosen]
    if (stop !== undefined && !narrowed(narrow) && (!on || foldable(route, chosen, at))) {
      onFold(stop.id, on)
    }
  }

  const keys = new Map<string, () => void>([
    ["escape", () => (narrowed(narrow) ? setNarrow(WHOLE) : onClose())],
    ["r", onClose],
    ["tab", () => setByRepo(!byRepo)],
    ["down", () => step(1)],
    ["j", () => step(1)],
    ["up", () => step(-1)],
    ["k", () => step(-1)],
    ["left", () => fold(true)],
    ["h", () => fold(true)],
    ["right", () => fold(false)],
    ["l", () => fold(false)],
    ["c", () => setNarrow(only(narrow, "changed"))],
    ["f", () => setNarrow(only(narrow, "flagged"))],
    ["/", () => setNarrow({ ...narrow, find: "", finding: true })],
    ["return", () => shown.length > 0 && onGo(route[chosen]?.id ?? "")],
  ])
  useKeyboard((key) => {
    if (narrow.finding && key.name !== "up" && key.name !== "down") {
      setNarrow(findKey(key, narrow))
      return
    }

    keys.get(key.sequence === "/" ? "/" : key.name)?.()
  })

  return { chosen, byRepo, narrow, shown }
}
