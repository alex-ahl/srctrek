import type {
  BranchChoices,
  ChangeChoice,
  ChangeSummary,
  NearbyCheckout,
  OpenPullRequest,
  ProposedRepo,
  RepoBranches,
  Settings as UserSettings,
  TrekEntry,
  TrekState,
  TrekStatus,
} from "@srctrek/core"
import type { RGBA } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useState } from "react"
import { ChangeStatus } from "./change-status"
import { type Opening, OpeningLine } from "./opening-line"
import type { SettingChange } from "../settings/rows"
import type { Editor } from "../editors/editors"
import { Footer } from "../ui/footer"
import { moveKeys, stepped } from "../ui/move"
import { useNow } from "../ui/clock"
import { PADDING, listHeight } from "../ui/layout"
import { itemKey, itemsOf, lineOfItem, listLines } from "./list/lines"
import { ListLineView } from "./list/view"
import { columnsOf } from "./list/columns"
import { rowsOf } from "./list/rows"
import { type SectionId, sectionsOf } from "./list/sections"
import { type StatusBlock, statusBlock } from "./status-block"
import { useTones } from "../ui/theme"
import { ChangeTitleBar } from "./change-title"
import { ChangeLine } from "./change-line"
import { visibleWindow } from "./list/window"
import { actionsFor, keyHints } from "./row-actions"
import { listKey, pickFor, selectedIndex, shownItems, toggled } from "./selection"
import { type Over, type Prompt, Bottom, overlayFor } from "./overlays"
import type { BuildRead } from "../build-view/read"

/**
 * What the change picker needs: the change chosen now, the changes to offer, where each one's
 * trek stands, and the pick.
 */
export type Choosing = Readonly<{
  choice: ChangeChoice
  load: () => Promise<BranchChoices>
  pullRequests: () => Promise<OpenPullRequest[]>
  nearby: () => Promise<NearbyCheckout[]>
  repoBranches: (path: string) => Promise<RepoBranches>
  fetchRepo: (path: string) => Promise<void>
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  onPick: (choice: ChangeChoice) => void
}>

export type Props = {
  entries: TrekEntry[]
  onOpen: (entry: TrekEntry) => void
  onQuit: () => void
  // where the change trek was started for stands; absent when there's none to show
  status?: TrekStatus | undefined
  // starts building the change's trek; absent when no agent is set
  onBuild?: (() => void) | undefined
  // starts building the trek of a trigger found in the code; absent when no agent is set
  onBuildTrigger?: ((trigger: string) => void) | undefined
  // a build of the trek by this name, `back` before its latest, as it stands
  onReadBuild?: ((name: string, back: number) => Promise<BuildRead>) | undefined
  // stops the build of the trek by this name
  onStopBuild?: ((name: string) => void) | undefined
  // repos the agent proposed adding to the repos list, each added or dismissed by the user;
  // added at the location the user gives when the agent found none
  proposals?: ProposedRepo[] | undefined
  onAddRepo?: ((name: string, location?: string) => void) | undefined
  onDismissRepo?: ((name: string) => void) | undefined
  // what the change is, for the title bar; absent when trek was started without one
  summary?: ChangeSummary | undefined
  // the change chosen, the changes to choose from, and what picking one does; absent, C does nothing
  choosing?: Choosing | undefined
  // a picked change on its way, or why it couldn't be opened
  opening?: Opening | undefined
  // where each saved trek stands against its branches, by name, as far as it's known yet
  states?: ReadonlyMap<string, TrekState> | undefined
  // the time "built today" is measured from; now, unless a test fixes it
  now?: Date | undefined
  // the selected row's background, from the terminal's colours; absent, a marker shows it
  tint?: RGBA | undefined
  // the editors treks can open in here, the one chosen, and what to do when one is picked
  editors?: readonly Editor[] | undefined
  editor?: Editor | undefined
  onChooseEditor?: ((editor: Editor) => void) | undefined
  // the user's settings, shown and changed on the settings screen
  settings?: UserSettings | undefined
  onChangeSetting?: SettingChange | undefined
}

// The change line, when there's a change to name, and the blank line under it when no block follows.
function headingLines(summary: ChangeSummary | undefined, block: StatusBlock | undefined): number {
  if (summary === undefined) {
    return 0
  }

  return block === undefined ? 2 : 1
}

// Above the list: what's open, a pick still opening or why it couldn't, and where its trek stands.
function Heading({
  summary,
  opening,
  block,
  width,
}: {
  summary: ChangeSummary | undefined
  opening: Opening | undefined
  block: StatusBlock | undefined
  width: number
}) {
  return (
    <>
      {summary !== undefined && (
        <box style={{ marginBottom: block === undefined ? 1 : 0, flexShrink: 0 }}>
          <ChangeLine summary={summary} width={width - 2 * PADDING} />
        </box>
      )}
      <OpeningLine opening={opening} />
      {block !== undefined && (
        <box style={{ marginBottom: 1, paddingLeft: summary === undefined ? 0 : 2, flexShrink: 0 }}>
          <ChangeStatus block={block} />
        </box>
      )}
    </>
  )
}

export function App(props: Props) {
  const tones = useTones()
  const { entries, onQuit, status, onBuild } = props
  const rows = rowsOf(entries, status, props.proposals ?? [])
  // the selected item by its key, so it stays put as rows move between sections
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState<ReadonlySet<SectionId>>(new Set())
  const [prompt, setPrompt] = useState<Prompt | undefined>(undefined)
  const [over, setOver] = useState<Over | undefined>(undefined)
  // what "built today" is measured from, kept current while the screen is open
  const now = useNow(props.now)

  const states = props.states ?? new Map<string, TrekState>()
  const sections = sectionsOf(rows, { status, summary: props.summary, states })
  const lines = listLines(sections, open)
  const items = itemsOf(lines)
  const keys = items.map(itemKey)
  const selected = selectedIndex(items, chosen, status)
  const item = items[selected]
  const row = item?.kind === "row" ? item.row : undefined

  // Opening a trek before an editor is chosen asks for one first.
  const { editor } = props
  const onOpen = (entry: TrekEntry) =>
    editor === undefined ? setPrompt({ kind: "editor", then: entry }) : props.onOpen(entry)
  const askLocation = (name: string) => setPrompt({ kind: "location", name })
  const openBuild = (name: string) => setOver({ kind: "build", name })
  const rowActions = actionsFor(row, { ...props, onOpen }, askLocation, openBuild)
  const pick = pickFor(item, rowActions.pick, (id) => setOpen(toggled(open, id)))
  const { build, showLog, stop, dismiss } = rowActions

  // from the selection as it is, so keys pressed faster than the screen redraws each count
  const move = (by: number) =>
    setChosen((key) => {
      const at = key === undefined ? -1 : keys.indexOf(key)
      return keys[stepped(at === -1 ? selected : at, by, keys.length)]
    })
  const actions = new Map([
    ["q", onQuit],
    ["b", () => build?.()],
    ["l", () => showLog?.()],
    ["x", () => stop?.()],
    ["d", () => dismiss?.()],
    ...moveKeys(move),
    ["return", () => pick?.()],
  ])
  const shifted = new Map([
    ["e", () => setPrompt({ kind: "editor" })],
    ["s", () => setOver("settings")],
    ["c", () => setOver("picker")],
  ])
  // While a prompt, settings, or the picker is open, keys go there, not to the list.
  const overlay = overlayFor(over, props, () => setOver(undefined))
  const onList = prompt === undefined && overlay === undefined
  useKeyboard((key) => onList && listKey(key, actions, shifted))

  const { width, height } = useTerminalDimensions()
  const changeEntry = entries.find((entry) => entry.name === status?.name)
  const block =
    status === undefined
      ? undefined
      : statusBlock(status, changeEntry, onBuild !== undefined, props.summary)
  const { start, end } = visibleWindow(
    lines.length,
    lineOfItem(lines, selected),
    listHeight(height, block, headingLines(props.summary, block)),
  )
  const shown = shownItems(lines.slice(start, end), items.length)
  const visibleRows = items.flatMap((each) => (each.kind === "row" ? [each.row] : []))
  const columns = columnsOf(visibleRows, width, { status, states, now })
  const context = { width, now, columns, status, states, tint: props.tint }

  if (overlay !== undefined) {
    return overlay
  }

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <ChangeTitleBar summary={props.summary} />
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
        <Heading summary={props.summary} opening={props.opening} block={block} width={width} />
        {rows.length === 0 ? (
          <text fg={tones.dim}>No treks in .srctrek/treks yet.</text>
        ) : (
          lines
            .slice(start, end)
            .map((line, i) => (
              <ListLineView key={start + i} line={line} selected={selected} context={context} />
            ))
        )}
      </box>
      <Bottom
        prompt={prompt}
        props={props}
        footer={
          <Footer
            keys={keyHints(item, status, { ...rowActions, pick }, props, block?.keys)}
            shown={shown}
          />
        }
        close={() => setPrompt(undefined)}
      />
    </box>
  )
}
