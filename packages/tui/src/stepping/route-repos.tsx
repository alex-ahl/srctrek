import { type RGBA, TextAttributes } from "@opentui/core"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import type { RouteStop } from "./route"
import { type Where, markOf, windowOf } from "./route-tree"

function LaneRow({
  stop,
  at,
  lane,
  column,
  where,
  chosen,
  tint,
}: {
  stop: RouteStop
  at: number
  lane: number
  column: number
  where: Where
  chosen: boolean
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const here = at === where.here
  return (
    <box
      style={{ flexShrink: 0, ...(chosen && tint !== undefined ? { backgroundColor: tint } : {}) }}
    >
      <text fg={COLOUR.text}>
        {" ".repeat(column * lane)}
        <span fg={tones.accent} attributes={TextAttributes.BOLD}>
          {markOf(stop, at, where)}
        </span>
        <span fg={tones.dim}>{`${String(stop.number).padStart(2)}  `}</span>
        <span
          fg={stop.visited && !here ? tones.dim : COLOUR.text}
          {...(here ? { attributes: TextAttributes.BOLD } : {})}
        >
          {fit(stop.name, Math.max(4, column - 6))}
        </span>
      </text>
    </box>
  )
}

/** The stops shown in the order they run, each in its repo's column under the repo's name. */
export function RepoLanes({
  route,
  shown,
  chosen,
  where,
  width,
  height,
  tint,
}: {
  route: readonly RouteStop[]
  shown: readonly number[]
  chosen: number
  where: Where
  width: number
  height: number
  tint: RGBA | undefined
}) {
  const repos = [...new Set(route.map((stop) => stop.repo))]
  const column = Math.max(16, Math.floor(width / Math.max(1, repos.length)))
  const rows = height - 2
  const { first, last } = windowOf(shown.length, Math.max(0, shown.indexOf(chosen)), rows)

  return (
    <box flexDirection="column" style={{ width, flexShrink: 0 }}>
      <text attributes={TextAttributes.BOLD}>
        {repos.map((repo) => fit(`  ${repo}`, column).padEnd(column)).join("")}
      </text>
      <text> </text>
      {shown.slice(first, last).map((index) => {
        const stop = route[index]
        return stop === undefined ? null : (
          <LaneRow
            key={stop.id}
            stop={stop}
            at={index}
            lane={repos.indexOf(stop.repo)}
            column={column}
            where={where}
            chosen={index === chosen}
            tint={tint}
          />
        )
      })}
    </box>
  )
}
