import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { EndView, OverviewView, SessionView, StepView } from "@srctrek/core"
import { useEffect, useState } from "react"
import { Footer } from "../ui/footer"
import { PADDING } from "../ui/layout"
import { fit, wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { TitleBar } from "../ui/title-bar"
import { type CodeLine, codeLines, windowOf } from "./lines"
import { type Move, useStepping } from "./use-stepping"

type Props = {
  root: string
  // the trek's saved name, and its title for the title bar
  name: string
  title: string
  onBack: () => void
  // the step's lines' background, when the terminal's colours are known
  tint: RGBA | undefined
}

// The call stack and what's beside it, on a terminal wide enough to spare the room.
const SIDE_WIDTH = 34
const SIDE_FROM_WIDTH = 100
// The line number and sign before each line's code.
const GUTTER = 7
// The title bar and the footer, each a line with its rule.
const CHROME_LINES = 4

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

function Line({ line, width, tint }: { line: CodeLine; width: number; tint: RGBA | undefined }) {
  const tones = useTones()
  const values = line.values === "" ? "" : `   ${line.values}`
  const arrows = line.arrows === "" ? "" : `   ${line.arrows}`
  const end = values.length + arrows.length
  const code = fit(line.text.replaceAll("\t", "  "), Math.max(1, width - GUTTER - end))
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
        {code.padEnd(width - GUTTER - end)}
        <span fg={tones.dim}>{values}</span>
        <span fg={line.leadsNext ? tones.accent : tones.dim}>{arrows}</span>
      </text>
    </box>
  )
}

// The step's file around it, the narration's band over its first line.
function Code({
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
  const band = bandLines(view, width - GUTTER).length
  const lineCount = text.split("\n").length
  const { first, last } = windowOf(view, lineCount, height, band)
  const lines = codeLines(view, text, first, last)

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {lines.map((line) => (
        <box key={line.number} flexDirection="column" style={{ flexShrink: 0 }}>
          {line.number === view.start_line && <Band view={view} width={width} />}
          <Line line={line} width={width} tint={tint} />
        </box>
      ))}
    </box>
  )
}

function Heading({ title }: { title: string }) {
  const tones = useTones()
  return <text fg={tones.dim}>{title}</text>
}

// The call stack newest first, what started it, the step's context, and its flag.
function Side({ view }: { view: StepView }) {
  const tones = useTones()
  const flag = view.flag ?? undefined
  const frames = view.stack.toReversed()
  const room = SIDE_WIDTH - 2
  const place = (ref: { file: string; start_line: number }) =>
    `${ref.file.split("/").at(-1) ?? ref.file}:${String(ref.start_line)}`

  return (
    <box flexDirection="column" style={{ width: SIDE_WIDTH, paddingLeft: 2, flexShrink: 0 }}>
      <Heading title="CALL STACK" />
      {frames.map((frame, i) => (
        <text key={frame.id} fg={i === 0 ? COLOUR.text : tones.dim}>
          {fit(
            `${frame.hop ? `↯ ${frame.repo}: ` : ""}${frame.name ?? place(frame)}  ${place(frame)}`,
            room,
          )}
        </text>
      ))}
      {view.started_by !== null && (
        <text fg={tones.dim}>
          {fit(`started by ${view.started_by.name ?? place(view.started_by)} ↯`, room)}
        </text>
      )}
      {view.context.length > 0 && (
        <box flexDirection="column" style={{ marginTop: 1 }}>
          <Heading title="CONTEXT" />
          {view.context.map((ref) => (
            <text key={ref.id} fg={tones.accent}>
              {fit(ref.name ?? place(ref), room)}
            </text>
          ))}
        </box>
      )}
      {flag !== undefined && (
        <box flexDirection="column" style={{ marginTop: 1 }}>
          <Heading title="FLAG" />
          {wrap(flag.note, room).map((line, i) => (
            <text key={i} fg={flag.severity === "high" ? tones.bad : tones.warn}>
              {line}
            </text>
          ))}
        </box>
      )}
    </box>
  )
}

// "Outcome   …" with the text wrapped under itself, past the label.
function Labelled({ label, text, width }: { label: string; text: string; width: number }) {
  const tones = useTones()
  const indent = 10
  return (
    <>
      {wrap(text, Math.min(width, 100) - indent).map((line, i) => (
        <text key={i} fg={tones.dim}>{`${(i === 0 ? label : "").padEnd(indent)}${line}`}</text>
      ))}
    </>
  )
}

// Before the first step: the trek's story, where it starts and ends, and how to begin.
function Overview({ view, width }: { view: OverviewView; width: number }) {
  const tones = useTones()
  return (
    <box flexDirection="column">
      <text attributes={TextAttributes.BOLD}>{view.title}</text>
      <text> </text>
      {wrap(view.overview, Math.min(width, 90)).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          {line}
        </text>
      ))}
      <text> </text>
      <Labelled
        label="Trigger"
        text={`${view.trigger.kind} · ${view.trigger.input}`}
        width={width}
      />
      <Labelled label="Outcome" text={view.outcome} width={width} />
      <Labelled label="Repos" text={view.repos.join(", ")} width={width} />
      <text> </text>
      <text fg={tones.dim}>{`${String(view.count)} stops · n to start`}</text>
    </box>
  )
}

// After the last step: the outcome, then every flag, most severe first.
function End({ view, width }: { view: EndView; width: number }) {
  const tones = useTones()
  return (
    <box flexDirection="column">
      <text attributes={TextAttributes.BOLD}>End of trek</text>
      {wrap(view.outcome, Math.min(width, 90)).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          {line}
        </text>
      ))}
      <text> </text>
      {view.flags.length === 0 && <text fg={tones.dim}>No flags.</text>}
      {view.flags.map((flag) => (
        <text key={flag.id} fg={flag.severity === "high" ? tones.bad : tones.warn}>
          {fit(`${String(flag.number)} · ${flag.name ?? flag.file} · ${flag.note}`, width)}
        </text>
      ))}
    </box>
  )
}

function Body({
  view,
  width,
  height,
  tint,
}: {
  view: SessionView
  width: number
  height: number
  tint: RGBA | undefined
}) {
  if (view.kind === "overview") {
    return <Overview view={view} width={width} />
  }

  if (view.kind === "end") {
    return <End view={view} width={width} />
  }

  const side = width >= SIDE_FROM_WIDTH
  const code = side ? width - SIDE_WIDTH : width
  return (
    <box flexDirection="row" style={{ flexGrow: 1 }}>
      <Code view={view} width={code} height={height} tint={tint} />
      {side && <Side view={view} />}
    </box>
  )
}

// The title bar's right side at a step: its repo and file and line.
function whereText(view: SessionView): string {
  return view.kind === "step" ? `${view.repo}  ${view.file}:${String(view.start_line)}` : ""
}

function stopText(view: SessionView): string {
  return view.kind === "step" ? `  ${String(view.number)} / ${String(view.count)}` : ""
}

const KEYS: readonly [string, Move][] = [
  ["n", "next"],
  ["p", "previous"],
  ["i", "into"],
  ["o", "out"],
]

/**
 * A trek stepped in the terminal: at a step, its file with the narration over it, its signs,
 * values, and arrows, and the call stack beside it; before the first, the overview; after the
 * last, the outcome and the flags.
 */
export function SteppingScreen({ root, name, title, onBack, tint }: Props) {
  const tones = useTones()
  const { width, height } = useTerminalDimensions()
  const stepping = useStepping(root, name)
  const move = stepping.kind === "open" ? stepping.move : undefined

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      onBack()
      return
    }

    if (key.name === "o" && key.shift) {
      move?.("over")
      return
    }

    const to = KEYS.find(([letter]) => letter === key.name)?.[1]
    if (to !== undefined) {
      move?.(to)
    }
  })

  const inner = width - 2 * PADDING
  const view = stepping.kind === "open" ? stepping.view : undefined

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <TitleBar
        left={
          <span>
            <span>{title}</span>
            <span fg={tones.dim}>{view === undefined ? "" : stopText(view)}</span>
          </span>
        }
        right={view === undefined ? "" : whereText(view)}
      />
      <box
        flexDirection="column"
        style={{
          flexGrow: 1,
          paddingTop: 1,
          paddingLeft: PADDING,
          paddingRight: PADDING,
          overflow: "hidden",
        }}
      >
        {stepping.kind === "opening" && <text fg={tones.dim}>opening…</text>}
        {stepping.kind === "failed" && <text fg={tones.bad}>{`✕ ${stepping.why}`}</text>}
        {view !== undefined && (
          <Body view={view} width={inner} height={height - CHROME_LINES - 1} tint={tint} />
        )}
      </box>
      <Footer
        keys={[
          { key: "n", does: "next" },
          { key: "p", does: "previous" },
          { key: "i", does: "into" },
          { key: "o", does: "out" },
          { key: "O", does: "over" },
          { key: "q", does: "home" },
        ]}
        shown=""
      />
    </box>
  )
}
