import { type RGBA, TextAttributes } from "@opentui/core"
import { fit } from "../ui/text"
import { COLOUR, type Tone, useTones } from "../ui/theme"
import { FLAGS } from "./flags"
import { type RouteStop, insideOf } from "./route"

// The mark and number before a stop's tree, and its place, change and flag after it.
const LEAD = 6
const PLACE = 18
const MARKS = 4

/** Where the trek is, for drawing the tree: the stop it's on, the one n goes to, what's running. */
export type Where = Readonly<{
  here: number
  next: string | undefined
  // the stops running at the one the trek is on, outermost first
  running: readonly number[]
}>

const placeOf = (stop: RouteStop) =>
  `${stop.file.split("/").at(-1) ?? stop.file}:${String(stop.line)}`

// A guide for each call the stop sits in, lit where it traces the call stack down to ▶.
function guidesOf(route: readonly RouteStop[], at: number, where: Where): boolean[] {
  const depth = route[at]?.depth ?? 0
  return Array.from({ length: depth }, (_, level) => {
    const caller = where.running.find((index) => route[index]?.depth === level)
    return caller !== undefined && caller < at && at <= where.here
  })
}

// The name's tone: the stop the trek's on in the text colour, the stops running at it lit, those
// already stepped to dimmed.
function nameTone(stop: RouteStop, at: number, where: Where): Tone | undefined {
  if (at === where.here) {
    return undefined
  }

  if (where.running.includes(at)) {
    return "accent"
  }

  return stop.visited ? "dim" : undefined
}

/** ▶ on the stop the trek's on, n on the one it goes to next. */
export function markOf(stop: RouteStop, at: number, where: Where): string {
  if (at === where.here) {
    return "▶ "
  }

  return stop.id === where.next ? "n " : "  "
}

// ↯ where a hop, or a move into another repo, reached the stop.
const hopMark = (stop: RouteStop, at: number) =>
  stop.hop || (stop.repoChange !== undefined && at > 0) ? "↯ " : ""

// After a hop's name, what carried it: "  on a timer".
const carrierOf = (stop: RouteStop) =>
  stop.hop && stop.through !== undefined ? `  ${stop.through}` : ""

function Marks({ stop }: { stop: RouteStop }) {
  const tones = useTones()
  const flag = stop.flag === undefined ? undefined : FLAGS[stop.flag.severity]
  return (
    <>
      <span fg={tones.good}>{stop.changed ? " +" : "  "}</span>
      <span fg={flag === undefined ? tones.dim : tones[flag.tone]}>{` ${flag?.mark ?? " "}`}</span>
    </>
  )
}

/**
 * A stop's row in the call tree: ▶ or n, its number, a guide for each call it's in, ↯ where a hop
 * reached it, its name and what carried the hop; then its place, change and flag.
 */
export function TreeRow({
  route,
  at,
  where,
  chosen,
  folded,
  width,
  tint,
}: {
  route: readonly RouteStop[]
  at: number
  where: Where
  chosen: boolean
  // the stops under it folded away, how many
  folded: number | undefined
  width: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const stop = route[at]
  if (stop === undefined) {
    return null
  }

  const here = at === where.here
  const guides = guidesOf(route, at, where)
  const hop = hopMark(stop, at)
  const fold = folded === undefined ? "" : "▸ "
  const hidden = folded === undefined ? "" : `  ${String(folded)} stop${folded === 1 ? "" : "s"}`
  const room =
    width - LEAD - PLACE - MARKS - guides.length * 2 - hop.length - fold.length - hidden.length
  const tone = nameTone(stop, at, where)
  const carrier = carrierOf(stop)
  const name = fit(stop.name, Math.max(1, room - carrier.length))

  return (
    <box
      style={{ flexShrink: 0, ...(chosen && tint !== undefined ? { backgroundColor: tint } : {}) }}
    >
      <text fg={COLOUR.text}>
        <span fg={tones.accent} attributes={TextAttributes.BOLD}>
          {markOf(stop, at, where)}
        </span>
        <span fg={tones.dim}>{`${String(stop.number).padStart(2)}  `}</span>
        {guides.map((lit, level) => (
          <span key={level} fg={lit ? tones.accent : tones.dim}>
            {"│ "}
          </span>
        ))}
        <span fg={tones.busy}>{hop}</span>
        <span fg={tones.accent}>{fold}</span>
        <span
          fg={tone === undefined ? COLOUR.text : tones[tone]}
          {...(here ? { attributes: TextAttributes.BOLD } : {})}
        >
          {name}
        </span>
        <span fg={tones.busy}>{fit(carrier, Math.max(0, room - name.length))}</span>
        <span fg={tones.dim}>{hidden}</span>
        {" ".repeat(Math.max(0, room - name.length - carrier.length))}
        <span fg={tones.dim}>{fit(placeOf(stop), PLACE).padStart(PLACE)}</span>
        <Marks stop={stop} />
      </text>
    </box>
  )
}

/** The rows in view: the chosen one kept a few from the bottom. */
export function windowOf(count: number, chosen: number, height: number) {
  const first = Math.max(0, Math.min(chosen - height + 3, count - height))
  return { first, last: first + height }
}

/** The stops shown as a call tree, the chosen one kept in view, folded calls on a row each. */
export function CallTree({
  route,
  shown,
  chosen,
  where,
  folded,
  width,
  height,
  tint,
}: {
  route: readonly RouteStop[]
  shown: readonly number[]
  chosen: number
  where: Where
  folded: ReadonlySet<string>
  width: number
  height: number
  tint: RGBA | undefined
}) {
  const { first, last } = windowOf(shown.length, Math.max(0, shown.indexOf(chosen)), height)
  const under = (index: number) =>
    folded.has(route[index]?.id ?? "") ? insideOf(route, index) : undefined

  return (
    <box flexDirection="column" style={{ width, flexShrink: 0 }}>
      {shown.slice(first, last).map((index) => (
        <TreeRow
          key={route[index]?.id ?? index}
          route={route}
          at={index}
          where={where}
          chosen={index === chosen}
          folded={under(index)}
          width={width}
          tint={tint}
        />
      ))}
    </box>
  )
}
