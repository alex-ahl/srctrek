import type { RGBA } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import type { SessionView } from "@srctrek/core"
import { Footer, type KeyHint } from "../ui/footer"
import { PADDING } from "../ui/layout"
import { useTones } from "../ui/theme"
import { TitleBar } from "../ui/title-bar"
import { Code } from "./code"
import { DetailsPanel } from "./details-panel"
import { type Layout, type Place, atStop, movedPlace } from "./lines"
import { End, Overview } from "./ends"
import { SIDE_WIDTH, Side } from "./side"
import { type Move, type Stepping, useStepping } from "./use-stepping"
import { useRef, useState } from "react"

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

type BodyProps = {
  view: SessionView
  width: number
  height: number
  place: Place | undefined
  onLayout: (layout: Layout) => void
  // details open over the code, with where enter goes and how they close
  details: Readonly<{ onGo: (id: string) => void; onClose: () => void }> | undefined
  tint: RGBA | undefined
}

function Body({ view, width, height, place, onLayout, details, tint }: BodyProps) {
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
      {details === undefined ? (
        <Code
          view={view}
          width={code}
          height={height}
          place={place}
          onLayout={onLayout}
          tint={tint}
        />
      ) : (
        <DetailsPanel view={view} width={code} height={height} {...details} tint={tint} />
      )}
      {side && <Side view={view} />}
    </box>
  )
}

// The title bar's right side at a step: its repo, and its file at the cursor's line.
function whereText(view: SessionView, cursor: number | undefined): string {
  return view.kind === "step"
    ? `${view.repo}  ${view.file}:${String(cursor ?? view.start_line)}`
    : ""
}

// The call made on the cursor's line, to step into; none puts into on the first not visited.
function callAt(view: SessionView | undefined, cursor: number | undefined): string | undefined {
  if (view?.kind !== "step" || cursor === undefined) {
    return undefined
  }

  return view.calls.find((call) => call.call_line === cursor)?.id
}

function stopText(view: SessionView): string {
  return view.kind === "step" ? `  ${String(view.number)} / ${String(view.count)}` : ""
}

/**
 * The cursor and the view over the file, kept within it: keys that move the cursor a line or a
 * page, `.` back to the stop; none at the stop as it opens.
 */
function useCursor(height: number) {
  const [place, setPlace] = useState<Place | undefined>(undefined)
  const layout = useRef<Layout | undefined>(undefined)
  const moveBy = (by: number) =>
    setPlace((was) => {
      const now = layout.current
      return now === undefined ? was : movedPlace(was ?? atStop(now), by, now)
    })
  const page = Math.max(1, height - 8)
  const cursorKeys = new Map<string, () => void>([
    ["j", () => moveBy(1)],
    ["down", () => moveBy(1)],
    ["k", () => moveBy(-1)],
    ["up", () => moveBy(-1)],
    ["pagedown", () => moveBy(page)],
    ["pageup", () => moveBy(-page)],
    [".", () => setPlace(undefined)],
    ["period", () => setPlace(undefined)],
  ])

  return {
    place,
    cursorKeys,
    onLayout: (now: Layout) => {
      layout.current = now
    },
    toStop: () => setPlace(undefined),
  }
}

/** Details over the code, open or not: where enter in them goes, moving the trek, and closing. */
function useDetails(stepping: Stepping, toStop: () => void) {
  const [open, setOpen] = useState(false)
  const details =
    open && stepping.kind === "open"
      ? {
          onGo: (id: string) => {
            stepping.go(id)
            toStop()
            setOpen(false)
          },
          onClose: () => setOpen(false),
        }
      : undefined

  return { details, openDetails: () => setOpen(true) }
}

const STEP_KEYS: readonly KeyHint[] = [
  { key: "n", does: "next" },
  { key: "p", does: "previous" },
  { key: "i", does: "into" },
  { key: "o", does: "out" },
  { key: "O", does: "over" },
  { key: "↑/↓", does: "line" },
  { key: "d", does: "details" },
  { key: "q", does: "home" },
]

const DETAILS_KEYS: readonly KeyHint[] = [
  { key: "↑/↓", does: "choose" },
  { key: "enter", does: "go there" },
  { key: "d", does: "close" },
]

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
  const { place, cursorKeys, onLayout, toStop } = useCursor(height)
  const view = stepping.kind === "open" ? stepping.view : undefined
  const { details, openDetails } = useDetails(stepping, toStop)
  // a move lands on the new stop, wherever the cursor was; into takes the call on its line
  const move = (to: Move) => {
    if (stepping.kind === "open") {
      stepping.move(to, to === "into" ? callAt(view, place?.cursor) : undefined)
      toStop()
    }
  }

  const keys = new Map<string, () => void>([
    ["q", onBack],
    ["escape", onBack],
    ["d", () => view?.kind === "step" && openDetails()],
    ...KEYS.map(([letter, to]): [string, () => void] => [letter, () => move(to)]),
    ...cursorKeys,
  ])
  useKeyboard((key) => {
    // while details are open, keys are theirs
    if (details !== undefined) {
      return
    }

    // O, over, is o with shift
    const run = key.name === "o" && key.shift ? () => move("over") : keys.get(key.name)
    run?.()
  })

  const inner = width - 2 * PADDING

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <TitleBar
        left={
          <span>
            <span>{title}</span>
            <span fg={tones.dim}>{view === undefined ? "" : stopText(view)}</span>
          </span>
        }
        right={view === undefined ? "" : whereText(view, place?.cursor)}
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
          <Body
            view={view}
            width={inner}
            height={height - CHROME_LINES - 1}
            place={place}
            onLayout={onLayout}
            details={details}
            tint={tint}
          />
        )}
      </box>
      <Footer keys={details === undefined ? STEP_KEYS : DETAILS_KEYS} shown="" />
    </box>
  )
}
