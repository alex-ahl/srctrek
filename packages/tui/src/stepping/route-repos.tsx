import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import type { RouteStop } from "./route"

/** The stops, one column per repo, each under its repo's heading, a stop's row at its turn. */
export function ByRepo({
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
