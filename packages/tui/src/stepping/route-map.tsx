import type { RGBA } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import { fit } from "../ui/text"
import { COLOUR, type Tone, useTones } from "../ui/theme"
import type { RouteStop } from "./route"

const FLAGS: Readonly<Record<NonNullable<RouteStop["flag"]>, [string, Tone]>> = {
  high: ["⚠ likely wrong", "bad"],
  medium: ["● risky", "warn"],
  low: ["● worth knowing", "dim"],
}

// Columns: the repo where it changes, the marker and number, the tree, then sign and flag.
const REPO_WIDTH = 12
const TREE_WIDTH = 44

// A stop as the call tree shows it: indented by depth, a branch line before it.
function treeText(stop: RouteStop): string {
  const indent = "   ".repeat(Math.max(0, stop.depth - 1))
  return `${indent}${stop.depth > 0 ? "└ " : ""}${stop.name}`
}

// The repo column: the repo on the first stop in it, ↯ when a hop crossed into it.
function repoText(stop: RouteStop): string {
  if (stop.repoChange === undefined) {
    return ""
  }

  return stop.number > 1 ? `${stop.repoChange} ↯` : stop.repoChange
}

function StopRow({
  stop,
  here,
  chosen,
  width,
  tint,
}: {
  stop: RouteStop
  here: boolean
  chosen: boolean
  width: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const flag = stop.flag === undefined ? undefined : FLAGS[stop.flag]
  const repo = repoText(stop)
  return (
    <box
      style={{ flexShrink: 0, ...(chosen && tint !== undefined ? { backgroundColor: tint } : {}) }}
    >
      <text fg={COLOUR.text}>
        <span fg={repo.endsWith("↯") ? tones.busy : tones.dim}>
          {`  ${repo}`.padEnd(REPO_WIDTH)}
        </span>
        <span fg={tones.accent}>{here ? "▶ " : "  "}</span>
        <span fg={tones.dim}>{String(stop.number).padStart(2)}</span>
        {`  ${fit(treeText(stop), TREE_WIDTH - 2).padEnd(TREE_WIDTH - 2)}`}
        <span fg={tones.good}>{stop.changed ? "+ " : "  "}</span>
        {flag !== undefined && (
          <span fg={tones[flag[1]]}>
            {fit(flag[0], Math.max(0, width - REPO_WIDTH - TREE_WIDTH - 8))}
          </span>
        )}
      </text>
    </box>
  )
}

// The same stops, one column per repo, each under its repo's heading, a stop's row at its turn.
function ByRepo({
  route,
  here,
  width,
}: {
  route: readonly RouteStop[]
  here: string | undefined
  width: number
}) {
  const tones = useTones()
  const repos = [...new Set(route.map((stop) => stop.repo))]
  const column = Math.max(16, Math.floor(width / Math.max(1, repos.length)))
  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      <text attributes={1}>{repos.map((repo) => `  ${repo}`.padEnd(column)).join("")}</text>
      {route.map((stop) => (
        <text key={stop.id} fg={stop.id === here ? COLOUR.text : tones.dim}>
          {" ".repeat(column * repos.indexOf(stop.repo))}
          {fit(
            `${stop.id === here ? "▶" : " "} ${String(stop.number).padStart(2)} ${stop.name}`,
            column,
          )}
        </text>
      ))}
    </box>
  )
}

/**
 * Every stop at once: by how calls nest, or, with tab, by repo. ↑/↓ choose, enter moves the trek
 * there, r or esc closes.
 */
export function RouteMap({
  route,
  here,
  width,
  height,
  onGo,
  onClose,
  tint,
}: {
  route: readonly RouteStop[]
  here: string | undefined
  width: number
  height: number
  onGo: (id: string) => void
  onClose: () => void
  tint: RGBA | undefined
}) {
  const [chosen, setChosen] = useState(
    Math.max(
      0,
      route.findIndex((stop) => stop.id === here),
    ),
  )
  const [byRepo, setByRepo] = useState(false)
  useKeyboard((key) => {
    const keys = new Map<string, () => void>([
      ["escape", onClose],
      ["r", onClose],
      ["tab", () => setByRepo(!byRepo)],
      ["down", () => setChosen((at) => Math.min(at + 1, route.length - 1))],
      ["j", () => setChosen((at) => Math.min(at + 1, route.length - 1))],
      ["up", () => setChosen((at) => Math.max(0, at - 1))],
      ["k", () => setChosen((at) => Math.max(0, at - 1))],
      ["return", () => onGo(route[chosen]?.id ?? "")],
    ])
    keys.get(key.name)?.()
  })

  if (byRepo) {
    return <ByRepo route={route} here={here} width={width} />
  }

  const first = Math.max(0, Math.min(chosen - height + 3, route.length - height))
  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {route.slice(first, first + height).map((stop, i) => (
        <StopRow
          key={stop.id}
          stop={stop}
          here={stop.id === here}
          chosen={first + i === chosen}
          width={width}
          tint={tint}
        />
      ))}
    </box>
  )
}

/** One line on every stop: each repo's stops as dots, this one ▶, flags marked, hops as ↯. */
export function RouteStrip({
  route,
  here,
}: {
  route: readonly RouteStop[]
  here: string | undefined
}) {
  const tones = useTones()
  return (
    <text fg={tones.dim}>
      {route.map((stop, i) => {
        const hop = stop.repoChange !== undefined ? `${i === 0 ? "" : "  ↯  "}${stop.repo} ` : " "
        const mark =
          stop.id === here ? "▶" : stop.flag === "high" ? "⚠" : stop.flag === undefined ? "●" : "●"
        const tone =
          stop.id === here
            ? tones.accent
            : stop.flag === "high"
              ? tones.bad
              : stop.flag === undefined
                ? tones.dim
                : tones.warn
        return (
          <span key={stop.id}>
            {hop}
            <span fg={tone}>{mark}</span>
          </span>
        )
      })}
    </text>
  )
}
