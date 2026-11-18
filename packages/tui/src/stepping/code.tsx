import { type RGBA, TextAttributes } from "@opentui/core"
import type { StepView } from "@srctrek/core"
import { useEffect, useState } from "react"
import { wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type CodeLine, codeLines, windowOf } from "./lines"
import { type Span, fittedSpans, useHighlighted } from "./highlight"

// The line number and sign before each line's code.
export const GUTTER = 7

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

function Line({
  line,
  spans,
  width,
  tint,
}: {
  line: CodeLine
  spans: readonly Span[] | undefined
  width: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const values = line.values === "" ? "" : `   ${line.values}`
  const arrows = line.arrows === "" ? "" : `   ${line.arrows}`
  const room = Math.max(1, width - GUTTER - values.length - arrows.length)
  const signTone = line.sign === "+" ? tones.good : tones.warn

  return (
    <box
      style={{
        flexShrink: 0,
        ...(line.inStep && tint !== undefined ? { backgroundColor: tint } : {}),
      }}
    >
      <text fg={COLOUR.text}>
        <span fg={tones.dim}>{String(line.number).padStart(4)}</span>
        <span fg={line.sign === "" ? tones.dim : signTone}>{` ${line.sign.padEnd(2)}`}</span>
        <CodeText line={line} spans={spans} room={room} />
        <span fg={tones.dim}>{values}</span>
        <span fg={line.leadsNext ? tones.accent : tones.dim}>{arrows}</span>
      </text>
    </box>
  )
}

// The step's file around it, the narration's band over its first line.
export function Code({
  view,
  width,
  height,
  tint,
}: {
  view: StepView
  width: number
  height: number
  tint: RGBA | undefined
}) {
  const text = useFileText(view.path)
  const highlighted = useHighlighted(text, view.path)
  const band = bandLines(view, width - GUTTER).length
  const lineCount = text.split("\n").length
  const { first, last } = windowOf(view, lineCount, height, band)
  const lines = codeLines(view, text, first, last)

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {lines.map((line) => (
        <box key={line.number} flexDirection="column" style={{ flexShrink: 0 }}>
          {line.number === view.start_line && <Band view={view} width={width} />}
          <Line line={line} spans={highlighted?.[line.number - 1]} width={width} tint={tint} />
        </box>
      ))}
    </box>
  )
}
