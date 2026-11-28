import { type RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import type { StepView } from "@srctrek/core"
import { useEffect, useState } from "react"
import { Separated } from "../ui/separated"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type DetailLine, detailLines } from "./details"
import type { Look } from "./peek"

// The cited files' lines, read once each as the panel opens, by path.
function useCitedFiles(view: StepView): ReadonlyMap<string, readonly string[]> {
  const [files, setFiles] = useState<ReadonlyMap<string, readonly string[]>>(new Map())

  useEffect(() => {
    let current = true
    const paths = [...new Set(view.came_from?.cites.map((cite) => cite.path) ?? [])]
    void Promise.all(
      paths.map(async (path) => {
        const text = await Bun.file(path)
          .text()
          .catch(() => "")
        return [path, text.split("\n")] as const
      }),
    ).then((read) => current && setFiles(new Map(read)))
    return () => {
      current = false
    }
  }, [view])

  return files
}

// The lines in view: from the top, moving down so the chosen line stays a few from the bottom,
// then `beyond` lines further, read past the last line that leads somewhere.
function windowAt(count: number, chosen: number, height: number, beyond: number) {
  const latest = Math.max(0, count - height)
  const first = Math.min(Math.max(0, chosen - height + 3) + beyond, latest)
  return { first, last: first + height, latest }
}

type Props = {
  view: StepView
  width: number
  height: number
  // goes to a step, by id, moving the trek there
  onGo: (id: string) => void
  // opens a cited line beside the trek
  onOpen: (look: Look) => void
  onClose: () => void
  tint: RGBA | undefined
}

/**
 * A step's details over its code: ↑/↓ choose among the lines that lead somewhere, and read on
 * past the last; enter goes to the step chosen, d or esc closes.
 */
export function DetailsPanel({ view, width, height, onGo, onOpen, onClose, tint }: Props) {
  const tones = useTones()
  const files = useCitedFiles(view)
  const lines = detailLines(
    view,
    width - 2,
    (path, line) => files.get(path)?.[line - 1]?.trim() ?? "",
  )
  const leads = lines.flatMap((line, at) =>
    line.goes === undefined && line.opens === undefined ? [] : [at],
  )
  const [chosen, setChosen] = useState(0)
  const [beyond, setBeyond] = useState(0)
  const at = leads[chosen]
  const { first, last, latest } = windowAt(lines.length, at ?? 0, height, beyond)

  // down moves to the next line that leads somewhere, past the last one it reads on
  const down = () =>
    chosen < leads.length - 1
      ? setChosen(chosen + 1)
      : setBeyond((was) => (first < latest ? was + 1 : was))
  const up = () => (beyond > 0 ? setBeyond(beyond - 1) : setChosen(Math.max(0, chosen - 1)))

  // enter goes to a step, or opens a cited line beside the trek
  const enter = (line: DetailLine | undefined) => {
    if (line?.goes !== undefined) {
      onGo(line.goes)
    } else if (line?.opens !== undefined) {
      onOpen(line.opens)
    }
  }

  useKeyboard((key) => {
    const keys = new Map<string, () => void>([
      ["escape", onClose],
      ["d", onClose],
      ["down", down],
      ["j", down],
      ["up", up],
      ["k", up],
      ["return", () => enter(lines[at ?? -1])],
    ])
    keys.get(key.name)?.()
  })

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {lines.slice(first, last).map((line, i) => (
        <Detail key={first + i} line={line} chosen={first + i === at} width={width} tint={tint} />
      ))}
      {lines.length === 0 && <text fg={tones.dim}>no details</text>}
    </box>
  )
}

function Detail({
  line,
  chosen,
  width,
  tint,
}: {
  line: DetailLine
  chosen: boolean
  width: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const text = fit(`${chosen ? "› " : "  "}${line.text}`, width)
  return (
    <box
      style={{ flexShrink: 0, ...(chosen && tint !== undefined ? { backgroundColor: tint } : {}) }}
    >
      <text
        fg={line.tone === undefined ? COLOUR.text : tones[line.tone]}
        {...(line.bold === true ? { attributes: TextAttributes.BOLD } : {})}
      >
        <Separated text={text} />
      </text>
    </box>
  )
}
