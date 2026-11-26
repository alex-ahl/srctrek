import { TextAttributes } from "@opentui/core"
import { fit, fitPath, wrap } from "../ui/text"
import { COLOUR, type Tone, useTones } from "../ui/theme"
import { FLAGS, flagWords } from "./flags"
import { type RouteStop, insideOf, runningAt } from "./route"
import { SEPARATOR } from "../ui/separator"

/** A line of the preview: its text and look. */
type PreviewLine = Readonly<{ text: string; tone?: Tone; bold?: boolean; italic?: boolean }>

const blank: PreviewLine = { text: "" }

// "STOP 4  you're here".
function headLines(stop: RouteStop, here: boolean, width: number): PreviewLine[] {
  const state = here ? "  you're here" : stop.visited ? "  seen" : ""
  const changed = stop.changed ? "  + changed" : ""
  const room = width - stop.repo.length - 3 - changed.length
  return [
    { text: `STOP ${String(stop.number)}${state}`, tone: "dim" },
    { text: fit(stop.name, width), bold: true },
    ...(stop.hop && stop.through !== undefined
      ? [{ text: fit(`↯ ${stop.through}`, width), tone: "busy" as const }]
      : []),
    {
      text: `${stop.repo}${SEPARATOR}${fitPath(`${stop.file}:${String(stop.line)}`, room)}${changed}`,
      tone: "dim",
    },
  ]
}

// Its predicted values, each labelled predicted.
function valueLines(stop: RouteStop, width: number): PreviewLine[] {
  return stop.values.map((value) => {
    const subject = value.role === "return" ? "returns" : value.name
    const sign = value.uncertain === true ? "≈?" : "≈"
    return {
      text: fit(`line ${String(value.line)}  ${subject} ${sign} ${value.value}   predicted`, width),
      tone: "dim",
    }
  })
}

function flagLines(stop: RouteStop, width: number): PreviewLine[] {
  const flag = stop.flag
  if (flag === undefined) {
    return []
  }

  const { tone } = FLAGS[flag.severity]
  return [
    blank,
    { text: flagWords(flag.severity), tone, bold: true },
    ...wrap(flag.note, width).map((text) => ({ text, tone })),
  ]
}

// The functions running at the stop, outermost first, each a step further in.
function runningLines(route: readonly RouteStop[], at: number, width: number): PreviewLine[] {
  const frames = runningAt(route, at)
  return [
    blank,
    { text: "RUNNING", tone: "dim" },
    ...frames.map((index, level): PreviewLine => {
      const frame = route[index]
      const text = `${"  ".repeat(level)}${frame?.name ?? ""}`
      return { text: fit(text, width), ...(index === at ? {} : { tone: "dim" as const }) }
    }),
  ]
}

function underLines(route: readonly RouteStop[], at: number): PreviewLine[] {
  const under = insideOf(route, at)
  return under === 0
    ? []
    : [
        blank,
        { text: `calls on: ${String(under)} stop${under === 1 ? "" : "s"} under it`, tone: "dim" },
      ]
}

/** The chosen stop in full, beside the tree: where it is, what it says, its flag, what's running. */
export function Preview({
  route,
  at,
  here,
  width,
  height,
}: {
  route: readonly RouteStop[]
  at: number
  here: number
  width: number
  height: number
}) {
  const tones = useTones()
  const stop = route[at]
  if (stop === undefined) {
    return null
  }

  const lines: PreviewLine[] = [
    ...headLines(stop, at === here, width),
    blank,
    ...wrap(stop.summary, width).map((text) => ({ text, italic: true })),
    ...valueLines(stop, width),
    ...flagLines(stop, width),
    ...runningLines(route, at, width),
    ...underLines(route, at),
  ]

  return (
    <box flexDirection="column" style={{ width, flexShrink: 0 }}>
      {lines.slice(0, height).map((line, i) => (
        <text
          key={i}
          fg={line.tone === undefined ? COLOUR.text : tones[line.tone]}
          attributes={
            (line.bold === true ? TextAttributes.BOLD : 0) |
            (line.italic === true ? TextAttributes.ITALIC : 0)
          }
        >
          {line.text}
        </text>
      ))}
    </box>
  )
}
