import type { RGBA } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useEffect, useState } from "react"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import type { DiffLine } from "./change"
import { fittedSpans, useHighlighted } from "./highlight"
import type { Look } from "./peek"

// A file's text, read as it opens; empty until read.
function useText(path: string): string {
  const [text, setText] = useState("")
  useEffect(() => {
    let current = true
    void Bun.file(path)
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

/** A file beside the trek, at a line: that line marked, the view around it, ↑/↓ to read on. */
export function FileAside({
  look,
  width,
  height,
  tint,
}: {
  look: Look
  width: number
  height: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const text = useText(look.path)
  const spans = useHighlighted(text, look.path)
  const lines = text.split("\n")
  const [scroll, setScroll] = useState(0)
  const room = Math.max(1, height - 1)
  const first = Math.min(Math.max(1, look.line - 4 + scroll), Math.max(1, lines.length - room + 1))

  useKeyboard((key) => {
    if (key.name === "down" || key.name === "j") setScroll((at) => at + 1)
    if (key.name === "up" || key.name === "k") setScroll((at) => at - 1)
  })

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {lines.slice(first - 1, first - 1 + room).map((line, i) => {
        const number = first + i
        const here = number === look.line
        const runs = fittedSpans(
          spans?.[number - 1] ?? [{ text: line, tone: undefined, italic: false }],
          width - 7,
        )
        return (
          <box
            key={number}
            style={{
              flexShrink: 0,
              ...(here && tint !== undefined ? { backgroundColor: tint } : {}),
            }}
          >
            <text fg={COLOUR.text}>
              <span fg={here ? tones.accent : tones.dim}>{here ? "›" : " "}</span>
              <span fg={here ? COLOUR.text : tones.dim}>{`${String(number).padStart(3)}   `}</span>
              {runs.map((run, at) => (
                <span key={at} fg={run.tone === undefined ? COLOUR.text : tones[run.tone]}>
                  {run.text}
                </span>
              ))}
            </text>
          </box>
        )
      })}
    </box>
  )
}

/** The change to the stop's file, line by line: removed on red, added on green, ↑/↓ to read on. */
export function ChangeAside({
  diff,
  width,
  height,
}: {
  diff: readonly DiffLine[]
  width: number
  height: number
}) {
  const tones = useTones()
  const [scroll, setScroll] = useState(0)
  useKeyboard((key) => {
    if (key.name === "down" || key.name === "j")
      setScroll((at) => Math.min(at + 1, Math.max(0, diff.length - height)))
    if (key.name === "up" || key.name === "k") setScroll((at) => Math.max(0, at - 1))
  })

  const sign = { added: "+", removed: "-", same: " ", hunk: "" } as const
  const tone = {
    added: tones.good,
    removed: tones.bad,
    same: COLOUR.text,
    hunk: tones.dim,
  } as const
  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {diff.length === 0 && <text fg={tones.dim}>no change to this file in the trek's range</text>}
      {diff.slice(scroll, scroll + height).map((line, i) => (
        <text key={scroll + i} fg={tone[line.kind]}>
          {fit(`${sign[line.kind]} ${line.text}`, width)}
        </text>
      ))}
    </box>
  )
}
