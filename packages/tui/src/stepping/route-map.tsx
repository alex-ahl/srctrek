import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type RouteStop, runningAt } from "./route"
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

/**
 * Every stop at once, as a call tree: what's running at ▶ lit down to it, the chosen stop in full
 * beside it; or, with tab, by repo. ↑/↓ choose, enter moves the trek there, r or esc closes.
 */
export function RouteMap({
  route,
  here,
  next,
  width,
  height,
  onGo,
  onClose,
  tint,
}: {
  route: readonly RouteStop[]
  here: string | undefined
  // the stop n goes to
  next: string | undefined
  width: number
  height: number
  onGo: (id: string) => void
  onClose: () => void
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const at = Math.max(
    0,
    route.findIndex((stop) => stop.id === here),
  )
  const [chosen, setChosen] = useState(at)
  const [byRepo, setByRepo] = useState(false)
  const down = () => setChosen((was) => Math.min(was + 1, route.length - 1))
  const up = () => setChosen((was) => Math.max(0, was - 1))
  useKeyboard((key) => {
    const keys = new Map<string, () => void>([
      ["escape", onClose],
      ["r", onClose],
      ["tab", () => setByRepo(!byRepo)],
      ["down", down],
      ["j", down],
      ["up", up],
      ["k", up],
      ["return", () => onGo(route[chosen]?.id ?? "")],
    ])
    keys.get(key.name)?.()
  })

  if (byRepo) {
    return <ByRepo route={route} here={here} width={width} />
  }

  const where: Where = { here: at, next, running: runningAt(route, at) }
  const preview = width >= PREVIEW_FROM
  const treeWidth = preview ? width - PREVIEW_WIDTH - 2 : width
  const rows = height - HEAD_LINES
  const { first, last } = windowOf(route.length, chosen, rows)

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      <RunningLine route={route} where={where} width={width} />
      <text> </text>
      <box flexDirection="row" style={{ flexGrow: 1 }}>
        <box flexDirection="column" style={{ width: treeWidth, flexShrink: 0 }}>
          {route.slice(first, last).map((stop, i) => (
            <TreeRow
              key={stop.id}
              route={route}
              at={first + i}
              where={where}
              chosen={first + i === chosen}
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
