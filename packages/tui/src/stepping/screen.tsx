import type { RGBA } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { SessionView } from "@srctrek/core"
import { Footer } from "../ui/footer"
import { PADDING } from "../ui/layout"
import { useTones } from "../ui/theme"
import { TitleBar } from "../ui/title-bar"
import { Code } from "./code"
import { End, Overview } from "./ends"
import { SIDE_WIDTH, Side } from "./side"
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

// Beside the code from this width.
const SIDE_FROM_WIDTH = 100
// The title bar and the footer, each a line with its rule.
const CHROME_LINES = 4

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
