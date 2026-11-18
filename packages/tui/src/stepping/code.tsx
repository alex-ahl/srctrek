import { RGBA, TextAttributes } from "@opentui/core"
import type { StepView } from "@srctrek/core"
import { useEffect, useState } from "react"
import { fit, wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type CodeLine, type Layout, type Place, codeLines, windowOf } from "./lines"
import { type Span, fittedSpans, useHighlighted } from "./highlight"

// The line number and sign before each line's code.
export const GUTTER = 7
// The code's own room on a line, before predicted values beside it get any.
const MIN_CODE = 40

const FLAG_HINTS = { medium: "● risky", low: "● worth knowing" } as const

/** A file's text, read again whenever the path changes; empty until read, or when it can't be. */
function useFileText(path: string): string {
  const [text, setText] = useState("")
  useEffect(() => {
    let current = true
    Bun.file(path)
      .text()
      .then(
        (read) => current && setText(read),
        () => current && setText(""),
      )
    return () => {
      current = false
    }
  }, [path])

  return text
}

// The narration's lines over the step: its summary, then a risky flag's hint and where next goes,
// then a likely-wrong flag's note in full.
function bandLines(
  view: StepView,
  width: number,
): { text: string; tone?: "warn" | "bad" | "dim" }[] {
  const summary = wrap(view.summary, width).map((text) => ({ text }))
  const flag = view.flag ?? undefined
  const hint =
    flag !== undefined && flag.severity !== "high" ? FLAG_HINTS[flag.severity] : undefined
  const next = view.step_kind === "context" ? undefined : view.next.text
  const hints = [hint, next].filter((each) => each !== undefined).join("  ·  ")
  const note = flag?.severity === "high" ? wrap(`⚠ ${flag.note}`, width) : []

  return [
    ...summary,
    ...(hints === "" ? [] : [{ text: hints, tone: "dim" as const }]),
    ...note.map((text) => ({ text, tone: "bad" as const })),
  ]
}

function Band({ view, width }: { view: StepView; width: number }) {
  const tones = useTones()
  return (
    <>
      {bandLines(view, width - GUTTER).map((line, i) => (
        <text key={i} fg={line.tone === undefined ? COLOUR.text : tones[line.tone]}>
          <span fg={tones.accent}>{"   ▌   "}</span>
          {line.text}
        </text>
      ))}
    </>
  )
}

// A line's code, in its language's colours once worked out, else plain, cut to `room`.
function CodeText({
  line,
  spans,
  room,
}: {
  line: CodeLine
  spans: readonly Span[] | undefined
  room: number
}) {
  const tones = useTones()
  const runs = fittedSpans(spans ?? [{ text: line.text, tone: undefined, italic: false }], room)
  const used = runs.reduce((total, run) => total + run.text.length, 0)

  return (
    <>
      {runs.map((run, i) =>
        run.italic ? (
          <span key={i} fg={tones.dim} attributes={TextAttributes.ITALIC}>
            {run.text}
          </span>
        ) : (
          <span key={i} fg={run.tone === undefined ? COLOUR.text : tones[run.tone]}>
            {run.text}
          </span>
        ),
      )}
      {" ".repeat(Math.max(0, room - used))}
    </>
  )
}

// How far the cursor's line moves from the step's tint toward the accent: clear on any theme,
// still quieter than the code on it.
const CURSOR_TOWARD_ACCENT = 0.22

const mixed = (from: RGBA, to: RGBA, amount: number) =>
  RGBA.fromValues(
    from.r + (to.r - from.r) * amount,
    from.g + (to.g - from.g) * amount,
    from.b + (to.b - from.b) * amount,
  )

// A line's background: the cursor's its own tint, the step's lines the step's, none elsewhere;
// without the terminal's colours, none, and the gutter's mark alone shows the cursor.
function backgroundOf(line: CodeLine, here: boolean, tint: RGBA | undefined, accent: RGBA) {
  if (tint === undefined) {
    return {}
  }

  if (here) {
    return { backgroundColor: mixed(tint, accent, CURSOR_TOWARD_ACCENT) }
  }

  return line.inStep ? { backgroundColor: tint } : {}
}

// Before a line's code: the cursor's mark, the line's number, and its sign.
function Gutter({ line, here }: { line: CodeLine; here: boolean }) {
  const tones = useTones()
  const signTone = line.sign === "+" ? tones.good : tones.warn
  return (
    <>
      <span fg={tones.accent}>{here ? "›" : " "}</span>
      <span fg={here ? COLOUR.text : tones.dim}>{String(line.number).padStart(3)}</span>
      <span fg={line.sign === "" ? tones.dim : signTone}>{` ${line.sign.padEnd(2)}`}</span>
    </>
  )
}

// A line of the file: the cursor's marked in the gutter, its number in the text colour.
function Line({
  line,
  spans,
  here,
  width,
  tint,
}: {
  line: CodeLine
  spans: readonly Span[] | undefined
  here: boolean
  width: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const arrows = line.arrows === "" ? "" : `   ${line.arrows}`
  // values give way to the code, cut to what's left past its own room; details show them whole
  const valueRoom = width - GUTTER - arrows.length - MIN_CODE
  const values = line.values === "" || valueRoom < 8 ? "" : fit(`   ${line.values}`, valueRoom)
  const room = Math.max(1, width - GUTTER - values.length - arrows.length)

  return (
    <box
      style={{
        flexShrink: 0,
        ...backgroundOf(line, here, tint, tones.accent),
      }}
    >
      <text fg={COLOUR.text}>
        <Gutter line={line} here={here} />
        <CodeText line={line} spans={spans} room={room} />
        <span fg={tones.dim}>{values}</span>
        <span fg={line.leadsNext ? tones.accent : tones.dim}>{arrows}</span>
      </text>
    </box>
  )
}

// Which way the stop is, when it's scrolled out of view, and the key back to it.
function AwayNote({ view, first, last }: { view: StepView; first: number; last: number }) {
  const tones = useTones()
  const away = view.start_line < first ? "above" : view.start_line > last ? "below" : undefined
  if (away === undefined) {
    return null
  }

  const arrow = away === "above" ? "↑" : "↓"
  return <text fg={tones.dim}>{`       ${arrow} the stop is ${away} · . back to it`}</text>
}

// The step's file around it, the narration's band over its first line, the cursor marked.
export function Code({
  view,
  width,
  height,
  place,
  onLayout,
  tint,
}: {
  view: StepView
  width: number
  height: number
  // the cursor and the view's first line; none at the stop as it opens
  place: Place | undefined
  // told how the file lays out, to move the cursor within it
  onLayout: (layout: Layout) => void
  tint: RGBA | undefined
}) {
  const text = useFileText(view.path)
  const highlighted = useHighlighted(text, view.path)
  const band = bandLines(view, width - GUTTER).length
  const lineCount = text.split("\n").length
  const { first, last, layout } = windowOf(view, lineCount, height - 1, band, place?.top)
  const lines = codeLines(view, text, first, last)
  const cursor = place?.cursor ?? view.start_line

  const { lines: count, room, atStop, latest, stop } = layout
  useEffect(
    () => onLayout({ lines: count, room, atStop, latest, stop }),
    [onLayout, count, room, atStop, latest, stop],
  )

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {view.start_line < first && <AwayNote view={view} first={first} last={last} />}
      {lines.map((line) => (
        <box key={line.number} flexDirection="column" style={{ flexShrink: 0 }}>
          {line.number === view.start_line && <Band view={view} width={width} />}
          <Line
            line={line}
            spans={highlighted?.[line.number - 1]}
            here={line.number === cursor}
            width={width}
            tint={tint}
          />
        </box>
      ))}
      {view.start_line > last && <AwayNote view={view} first={first} last={last} />}
    </box>
  )
}
