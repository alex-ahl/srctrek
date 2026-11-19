import type { RGBA } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import type { SessionView, StepView } from "@srctrek/core"
import { Footer, type KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup, OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { PADDING } from "../ui/layout"
import { fit } from "../ui/text"
import { useTones } from "../ui/theme"
import { TitleBar } from "../ui/title-bar"
import { Code } from "./code"
import { type Layout, type Place, atStop, movedPlace } from "./lines"
import { End, Overview } from "./ends"
import { SIDE_WIDTH, Side } from "./side"
import { type Move, type Stepping, useStepping } from "./use-stepping"
import { type Layer, LayerView, layerKeys, layerWhere, useLayer } from "./layers"
import type { RouteStop } from "./route"
import { type Look, calledOn, definitionsOf } from "./peek"
import { openAtLine } from "../editors/editors"
import { type PageActions, pageGroups, pageHints, pageKeys } from "./page"
import { MovesLine } from "./moves"
import { type ReactNode, useRef, useState } from "react"

type Props = {
  root: string
  // how to start the user's editor at a line, for e; none without one
  editor: string | undefined
  // the trek's saved name, and its title for the title bar
  name: string
  title: string
  // the overview is the trek's page: what it offers besides stepping here
  page: PageActions
  onBack: () => void
  // the step's lines' background, when the terminal's colours are known
  tint: RGBA | undefined
}

// Beside the code from this width.
const SIDE_FROM_WIDTH = 100
// The title bar and the footer, each a line with its rule.
const CHROME_LINES = 4

// The call stack on one line, newest first, where there's no room for it beside the code.
function StackLine({ view, width }: { view: StepView; width: number }) {
  const tones = useTones()
  const frames = view.stack
    .toReversed()
    .map((frame) => `${frame.hop ? "↯ " : ""}${frame.name ?? frame.file}`)
  return <text fg={tones.dim}>{fit(frames.join(" › "), width)}</text>
}

type BodyProps = {
  view: SessionView
  width: number
  height: number
  place: Place | undefined
  onLayout: (layout: Layout) => void
  // what's open over the code, drawn in its place
  over: (width: number, height: number) => ReactNode
  tint: RGBA | undefined
}

function Body({ view, width, height, place, onLayout, over, tint }: BodyProps) {
  if (view.kind === "overview") {
    return <Overview view={view} width={width} />
  }

  if (view.kind === "end") {
    return <End view={view} width={width} />
  }

  const side = width >= SIDE_FROM_WIDTH
  const code = side ? width - SIDE_WIDTH : width
  // no room beside the code: the moves and the call stack on lines over it
  const room = side ? height : height - 2
  const drawn = over(code, room)
  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      {!side && <MovesLine view={view} width={width} />}
      {!side && <StackLine view={view} width={width} />}
      <box flexDirection="row" style={{ flexGrow: 1 }}>
        {drawn ?? (
          <Code
            view={view}
            width={code}
            height={room}
            place={place}
            onLayout={onLayout}
            tint={tint}
          />
        )}
        {side && <Side view={view} cursorAt={place} />}
      </box>
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

// "  6 / 15 · api 2 of 5 · ⚠ 1 ahead": the stop among them all, its place in its repo's run of
// stops, and the likely-wrong flags still to come.
function stopText(view: SessionView, route: readonly RouteStop[]): string {
  if (view.kind !== "step") {
    return ""
  }

  return `  ${String(view.number)} / ${String(view.count)}${inRepo(route, view.id)}${flagsAhead(route, view.id)}`
}

// " · api 2 of 5": the stop's place among the stops of its repo, between hops.
function inRepo(route: readonly RouteStop[], here: string): string {
  const at = route.findIndex((stop) => stop.id === here)
  const stop = route[at]
  if (stop === undefined) {
    return ""
  }

  const startsRun = (each: RouteStop) => each.repoChange !== undefined
  const start = route.slice(0, at + 1).findLastIndex(startsRun)
  const after = route.slice(at + 1).findIndex(startsRun)
  const end = after === -1 ? route.length : at + 1 + after
  return ` · ${stop.repo} ${String(at - start + 1)} of ${String(end - start)}`
}

function flagsAhead(route: readonly RouteStop[], here: string): string {
  const at = route.findIndex((stop) => stop.id === here)
  const ahead = route.slice(at + 1).filter((stop) => stop.flag === "high").length
  return ahead === 0 ? "" : ` · ⚠ ${String(ahead)} ahead`
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

// The footer at a stop: moving the trek, and its details; ? lists the rest.
const STEP_KEYS: readonly KeyHint[] = [
  { key: "n/p", does: "next/prev" },
  { key: "i/o/O", does: "in/out/over" },
  { key: "d", does: "details" },
  HELP_HINT,
]

// Every key at a stop, for the panel ? opens.
const STEP_GROUPS: readonly KeyGroup[] = [
  {
    title: "move",
    keys: [
      { key: "n/p", does: "next and previous stop" },
      { key: "i", does: "into the call on the cursor's line" },
      { key: "o/O", does: "out, over" },
      { key: "↑/↓", does: "the cursor through the stop's file" },
      { key: ".", does: "back to the stop" },
    ],
  },
  {
    title: "look",
    keys: [
      { key: "enter", does: "the step a call leads to, or where it's defined" },
      { key: "d", does: "the stop's details" },
      { key: "D", does: "the change to the stop's file" },
      { key: "r", does: "the route map" },
      { key: "e", does: "the cursor's line in your editor" },
    ],
  },
  { title: "leave", keys: [{ key: "q", does: "home" }] },
]

type KeyMap = ReadonlyMap<string, () => void>

// A look or the change: back to the stop, or, on a look, its line in the editor.
function asideKeys(
  layer: Layer | undefined,
  back: () => void,
  edit: (path: string, line: number) => void,
): KeyMap {
  const look = layer?.kind === "look" ? layer.look : undefined
  return new Map([
    [".", back],
    ["period", back],
    ["escape", back],
    ["D", back],
    ["e", () => look !== undefined && edit(look.path, look.line)],
  ])
}

// A letter typed with shift as its capital, "O" for over, so maps name capitals as they're shown.
const shifted = (key: Readonly<{ name: string; shift: boolean }>) =>
  key.shift && key.name.length === 1 ? key.name.toUpperCase() : key.name

// What a key does with `layer` open: details and the route map take their own keys, a look or
// the change its keys; at a stop, a move, a layer, or the cursor.
function keyFor(
  key: Readonly<{ name: string; shift: boolean }>,
  layer: Layer | undefined,
  maps: Readonly<{ keys: KeyMap; cursorKeys: KeyMap; asideKeys: KeyMap; move: (to: Move) => void }>,
): (() => void) | undefined {
  if (layer?.kind === "details" || layer?.kind === "route") {
    return undefined
  }

  if (layer !== undefined) {
    return maps.asideKeys.get(shifted(key))
  }

  const name = shifted(key)
  return maps.keys.get(name) ?? maps.cursorKeys.get(name)
}

type KeyContext = Readonly<{
  stepping: Stepping
  view: SessionView | undefined
  cursor: number
  open: (layer: Layer) => void
  onBack: () => void
  move: (to: Move) => void
  edit: (path: string, line: number) => void
  // a short note in the footer, until the next key
  say: (note: string) => void
}>

/** The keys at a stop: moves, the layers over the code, a look at the cursor's line, the editor. */
function stepKeys({ stepping, view, cursor, open, onBack, move, edit, say }: KeyContext) {
  const atStep = stepping.kind === "open" && view?.kind === "step" ? { stepping, view } : undefined
  return new Map<string, () => void>([
    ["q", onBack],
    ["escape", onBack],
    ...KEYS.map(([letter, to]): [string, () => void] => [letter, () => move(to)]),
    ["d", () => atStep !== undefined && open({ kind: "details" })],
    ["r", () => stepping.kind === "open" && open({ kind: "route" })],
    [
      "D",
      () =>
        void atStep?.stepping.changeAt(atStep.view).then((diff) => open({ kind: "change", diff })),
    ],
    [
      "return",
      () =>
        atStep !== undefined &&
        void lookAt(atStep, cursor).then((look) =>
          look === undefined
            ? say("no definition found for a call on this line")
            : open({ kind: "look", look }),
        ),
    ],
    ["e", () => atStep !== undefined && edit(atStep.view.path, cursor)],
  ])
}

type AtStep = Readonly<{ stepping: Extract<Stepping, { kind: "open" }>; view: StepView }>

/**
 * What enter shows from the cursor's line: the step a call there leads to, without stepping in;
 * else where the function it calls is defined, found by name.
 */
async function lookAt({ stepping, view }: AtStep, cursor: number): Promise<Look | undefined> {
  const call = view.calls.find((each) => each.call_line === cursor)
  if (call !== undefined) {
    return {
      path: call.path,
      line: call.start_line,
      label: `${call.name ?? call.file} · i steps in`,
    }
  }

  const text = await Bun.file(view.path)
    .text()
    .catch(() => "")
  const name = calledOn(text.split("\n")[cursor - 1] ?? "")
  const dir = stepping.dirOf(view.repo)
  if (name === undefined || dir === undefined) {
    return undefined
  }

  const found = await definitionsOf(dir, name)
  const first = found[0]
  const more = found.length > 1 ? `, 1 of ${String(found.length)}` : ""
  return first === undefined
    ? undefined
    : { ...first, label: `${first.label} · found by name${more}` }
}

const KEYS: readonly [string, Move][] = [
  ["n", "next"],
  ["p", "previous"],
  ["i", "into"],
  ["o", "out"],
  ["O", "over"],
]

/**
 * A trek stepped in the terminal: at a step, its file with the narration over it, its signs,
 * values, and arrows, and the call stack beside it; before the first, the overview; after the
 * last, the outcome and the flags.
 */
/** What the screen does from a stop: move the trek, go back to the stop, open the editor. */
function useActions(
  stepping: Stepping,
  place: Place | undefined,
  toStop: () => void,
  close: () => void,
  editor: string | undefined,
) {
  const renderer = useRenderer()
  const view = stepping.kind === "open" ? stepping.view : undefined
  // a move lands on the new stop, wherever the cursor was; into takes the call on its line
  const move = (to: Move) => {
    if (stepping.kind === "open") {
      stepping.move(to, to === "into" ? callAt(view, place?.cursor) : undefined)
      toStop()
    }
  }
  const back = () => {
    close()
    toStop()
  }
  const edit = (path: string, line: number) =>
    editor === undefined ? undefined : void openAtLine(renderer, editor, path, line)

  return {
    view,
    move,
    back,
    edit,
    cursor: place?.cursor ?? (view?.kind === "step" ? view.start_line : 1),
  }
}

// What the footer offers: what's open's keys, the page's on the overview, else a stop's.
function footerKeys(layer: Layer | undefined, onPage: boolean, page: PageActions) {
  if (layer !== undefined) {
    return layerKeys(layer)
  }

  return onPage ? pageHints(page) : STEP_KEYS
}

// The trek's title and the stop's number; on the right, where the cursor is, or what's open.
function StepTitle({
  title,
  view,
  route,
  layer,
  cursor,
  note,
}: {
  title: string
  view: SessionView | undefined
  route: readonly RouteStop[]
  layer: Layer | undefined
  cursor: number | undefined
  // said in place of where the cursor is, until the next key
  note: string
}) {
  const tones = useTones()
  const where = note !== "" ? note : view === undefined ? "" : whereText(view, cursor)
  return (
    <TitleBar
      left={
        <span>
          <span>{title}</span>
          <span fg={tones.dim}>{view === undefined ? "" : stopText(view, route)}</span>
        </span>
      }
      right={(layer === undefined ? undefined : layerWhere(layer)) ?? where}
    />
  )
}

// Under the title bar: opening, why the trek couldn't open, or the trek where it is.
function Main({ stepping, children }: { stepping: Stepping; children: ReactNode }) {
  const tones = useTones()
  return (
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
      {children}
    </box>
  )
}

/**
 * A trek stepped in the terminal: at a step, its file with the narration over it, its signs,
 * values, and arrows, and the call stack beside it; before the first, the overview; after the
 * last, the outcome and the flags.
 */
export function SteppingScreen({ root, name, title, editor, page, onBack, tint }: Props) {
  const { width, height } = useTerminalDimensions()
  const stepping = useStepping(root, name)
  const { place, cursorKeys, onLayout, toStop } = useCursor(height)
  const { layer, open, close } = useLayer()
  const { view, move, back, edit, cursor } = useActions(stepping, place, toStop, close, editor)

  const [note, setNote] = useState("")
  const help = useKeysHelp()
  const stopKeys = new Map([
    ...stepKeys({ stepping, view, cursor, open, onBack, move, edit, say: setNote }),
    ["?", help.show],
  ])
  const onPage = view?.kind === "overview"
  const keys = onPage ? new Map([...stopKeys, ...pageKeys(page, () => move("next"))]) : stopKeys
  useKeyboard(
    help.guard((key) => {
      setNote("")
      const aside = asideKeys(layer, back, edit)
      keyFor(key, layer, { keys, cursorKeys, asideKeys: aside, move })?.()
    }),
  )

  const opened = stepping.kind === "open" ? stepping : undefined
  const over = (code: number, room: number): ReactNode =>
    layer === undefined || opened === undefined || view?.kind !== "step" ? undefined : (
      <LayerView
        layer={layer}
        view={view}
        stepping={opened}
        width={code}
        height={room}
        tint={tint}
        onWent={back}
        open={open}
        close={close}
      />
    )

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <StepTitle
        title={title}
        view={view}
        route={opened?.route ?? []}
        layer={layer}
        cursor={place?.cursor}
        note={note}
      />
      <Main stepping={stepping}>
        <OrKeysHelp open={help.open} groups={onPage ? pageGroups(page) : STEP_GROUPS}>
          {view !== undefined && (
            <Body
              view={view}
              width={width - 2 * PADDING}
              height={height - CHROME_LINES - 1}
              place={place}
              onLayout={onLayout}
              over={over}
              tint={tint}
            />
          )}
        </OrKeysHelp>
      </Main>
      <Footer keys={help.footer(footerKeys(layer, onPage, page))} shown="" />
    </box>
  )
}
