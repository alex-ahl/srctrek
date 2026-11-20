import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type RouteStop, hiddenBy, insideOf, runningAt } from "./route"
import { Preview } from "./route-preview"
import { ByRepo } from "./route-repos"
import { TreeRow, type Where } from "./route-tree"

// The preview beside the tree from this width, and its share of it.
const PREVIEW_FROM = 90
const PREVIEW_WIDTH = 46
// The line naming what's running at ▶, and the gap under it.
const HEAD_LINES = 2

// "running at ▶  checkout › pay › charge": the call stack, outermost first.
function RunningLine({
  route,
  where,
  width,
}: {
  route: readonly RouteStop[]
  where: Where
  width: number
}) {
  const tones = useTones()
  const names = where.running.map((index) => route[index]?.name ?? "")
  const last = names.length - 1
  return (
    <text>
      <span fg={tones.dim}>{"running at ▶  "}</span>
      {names.map((name, i) => (
        <span key={i}>
          {i > 0 && <span fg={tones.dim}>{" › "}</span>}
          <span
            fg={i === last ? COLOUR.text : tones.accent}
            {...(i === last ? { attributes: TextAttributes.BOLD } : {})}
          >
            {fit(name, Math.max(4, Math.floor((width - 14) / Math.max(1, names.length)) - 3))}
          </span>
        </span>
      ))}
    </text>
  )
}

// The rows in view: the chosen one kept a few from the bottom.
function windowOf(count: number, chosen: number, height: number) {
  const first = Math.max(0, Math.min(chosen - height + 3, count - height))
  return { first, last: first + height }
}

// Whether the call at `chosen` can fold: it leads somewhere, and the trek isn't inside it.
function foldable(route: readonly RouteStop[], chosen: number, at: number): boolean {
  const under = insideOf(route, chosen)
  return under > 0 && !(at > chosen && at <= chosen + under)
}

type MapState = Readonly<{
  route: readonly RouteStop[]
  shown: readonly number[]
  at: number
  folded: ReadonlySet<string>
  onFold: (id: string, folded: boolean) => void
  onGo: (id: string) => void
  onClose: () => void
}>

// The map's keys: ↑/↓ through the stops shown, ←/→ fold and unfold the chosen call, tab by repo.
function useMapKeys({ route, shown, at, onFold, onGo, onClose }: MapState) {
  const [chosen, setChosen] = useState(at)
  const [byRepo, setByRepo] = useState(false)
  const step = (by: 1 | -1) => setChosen((was) => shown[shown.indexOf(was) + by] ?? was)
  const fold = (on: boolean) => {
    const stop = route[chosen]
    if (stop !== undefined && (!on || foldable(route, chosen, at))) {
      onFold(stop.id, on)
    }
  }

  useKeyboard((key) => {
    const keys = new Map<string, () => void>([
      ["escape", onClose],
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
      ["return", () => onGo(route[chosen]?.id ?? "")],
    ])
    keys.get(key.name)?.()
  })

  return { chosen, byRepo }
}

type Props = {
  route: readonly RouteStop[]
  here: string | undefined
  // the stop n goes to, past folded calls
  next: string | undefined
  // the calls folded, whose stops are left out and stepped past
  folded: ReadonlySet<string>
  onFold: (id: string, folded: boolean) => void
  width: number
  height: number
  onGo: (id: string) => void
  onClose: () => void
  tint: RGBA | undefined
}

/**
 * Every stop at once, as a call tree: what's running at ▶ lit down to it, folded calls on a row
 * each, the chosen stop in full beside it; or, with tab, by repo. ↑/↓ choose, ←/→ fold, enter moves
 * the trek there, r or esc closes.
 */
export function RouteMap(props: Props) {
  const { route, here, next, folded, width, height, tint } = props
  const tones = useTones()
  const at = Math.max(
    0,
    route.findIndex((stop) => stop.id === here),
  )
  const hidden = hiddenBy(route, folded)
  const shown = route.flatMap((stop, index) => (hidden.has(stop.id) ? [] : [index]))
  const { chosen, byRepo } = useMapKeys({ ...props, shown, at })

  if (byRepo) {
    return <ByRepo route={route} here={here} width={width} />
  }

  const where: Where = { here: at, next, running: runningAt(route, at) }
  const preview = width >= PREVIEW_FROM
  const treeWidth = preview ? width - PREVIEW_WIDTH - 2 : width
  const rows = height - HEAD_LINES
  const { first, last } = windowOf(shown.length, Math.max(0, shown.indexOf(chosen)), rows)

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      <RunningLine route={route} where={where} width={width} />
      <text> </text>
      <box flexDirection="row" style={{ flexGrow: 1 }}>
        <box flexDirection="column" style={{ width: treeWidth, flexShrink: 0 }}>
          {shown.slice(first, last).map((index) => (
            <TreeRow
              key={route[index]?.id ?? index}
              route={route}
              at={index}
              where={where}
              chosen={index === chosen}
              folded={folded.has(route[index]?.id ?? "") ? insideOf(route, index) : undefined}
              width={treeWidth}
              tint={tint}
            />
          ))}
        </box>
        {preview && (
          <box
            border={["left"]}
            borderColor={tones.dim}
            style={{ paddingLeft: 1, marginLeft: 1, flexShrink: 0 }}
          >
            <Preview route={route} at={chosen} here={at} width={PREVIEW_WIDTH} height={rows} />
          </box>
        )}
      </box>
    </box>
  )
}
