import { type RGBA, TextAttributes } from "@opentui/core"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type RouteStop, runningAt } from "./route"
import { useMapKeys } from "./route-keys"
import { type Narrow, narrowText } from "./route-narrow"
import { Preview } from "./route-preview"
import { FileTree } from "./route-file-tree"
import { RepoLanes } from "./route-repos"
import { CallTree, type Where } from "./route-tree"

// The preview beside the tree from this width, and its share of it.
const PREVIEW_FROM = 90
const PREVIEW_WIDTH = 46
// The line naming what's running at ▶, and the gap under it.
const HEAD_LINES = 2

// "running at ▶  checkout › pay › charge": the call stack, outermost first.
function RunningLine({
  route,
  where,
  width,
}: {
  route: readonly RouteStop[]
  where: Where
  width: number
}) {
  const tones = useTones()
  const names = where.running.map((index) => route[index]?.name ?? "")
  const last = names.length - 1
  return (
    <text>
      <span fg={tones.dim}>{"running at ▶  "}</span>
      {names.map((name, i) => (
        <span key={i}>
          {i > 0 && <span fg={tones.dim}>{" › "}</span>}
          <span
            fg={i === last ? COLOUR.text : tones.accent}
            {...(i === last ? { attributes: TextAttributes.BOLD } : {})}
          >
            {fit(name, Math.max(4, Math.floor((width - 14) / Math.max(1, names.length)) - 3))}
          </span>
        </span>
      ))}
    </text>
  )
}

// What the map's narrowed to, under the running line; a blank line when it isn't.
function NarrowLine({ narrow, count }: { narrow: Narrow; count: number }) {
  const tones = useTones()
  const text = narrowText(narrow, count)
  return (
    <text>
      <span fg={tones.accent}>{text}</span>
      <span fg={tones.dim}>{text === "" ? "" : "   esc shows all"}</span>
    </text>
  )
}

type Props = {
  route: readonly RouteStop[]
  here: string | undefined
  // the stop n goes to, past folded calls
  next: string | undefined
  // the calls folded, whose stops are left out and stepped past
  folded: ReadonlySet<string>
  onFold: (id: string, folded: boolean) => void
  width: number
  height: number
  onGo: (id: string) => void
  onClose: () => void
  tint: RGBA | undefined
}

/**
 * Every stop at once, as a call tree: what's running at ▶ lit down to it, folded calls on a row
 * each, the chosen stop in full beside it; with tab, in a column per repo, or by file. Narrowed to
 * changed or flagged stops, or by name. Enter moves the trek to the chosen stop.
 */
export function RouteMap(props: Props) {
  const { route, here, next, folded, width, height, tint } = props
  const tones = useTones()
  const at = Math.max(
    0,
    route.findIndex((stop) => stop.id === here),
  )
  const { chosen, view, narrow, shown, files } = useMapKeys({ ...props, at })
  const where: Where = { here: at, next, running: runningAt(route, at) }
  const preview = width >= PREVIEW_FROM
  const treeWidth = preview ? width - PREVIEW_WIDTH - 2 : width
  const rows = height - HEAD_LINES
  const shared = { route, chosen, where, width: treeWidth, height: rows, tint }

  return (
    <box flexDirection="column" style={{ flexGrow: 1 }}>
      <RunningLine route={route} where={where} width={width} />
      <NarrowLine narrow={narrow} count={shown.length} />
      <box flexDirection="row" style={{ flexGrow: 1 }}>
        {view === "calls" && <CallTree {...shared} shown={shown} folded={folded} />}
        {view === "repos" && <RepoLanes {...shared} shown={shown} />}
        {view === "files" && <FileTree {...shared} files={files} />}
        {preview && shown.length > 0 && (
          <box
            border={["left"]}
            borderColor={tones.dim}
            style={{ paddingLeft: 1, marginLeft: 1, flexShrink: 0 }}
          >
            <Preview route={route} at={chosen} here={at} width={PREVIEW_WIDTH} height={rows} />
          </box>
        )}
      </box>
    </box>
  )
}
