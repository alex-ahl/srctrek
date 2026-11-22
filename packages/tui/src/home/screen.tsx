import type {
  BranchChoices,
  ChangeChoice,
  ChangeSummary,
  HomeFocus,
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
import { type Opening, OpeningLine } from "./opening-line"
import type { SettingChange } from "../settings/rows"
import type { Editor, StepPlace } from "../editors/editors"
import { Footer } from "../ui/footer"
import { OrKeysHelp, useKeysHelp } from "../ui/keys-help"
import { HOME_GROUPS } from "./footer-keys"
import { moveKeys, stepped } from "../ui/move"
import { useNow } from "../ui/clock"
import { PADDING, listHeight } from "../ui/layout"
import { itemKey, itemsOf, lineOfItem, listLines } from "./list/lines"
import { ListLineView } from "./list/view"
import { columnsOf } from "./list/columns"
import { type AskedWayIn, type ChangeOpen, type Row, rowsOf } from "./list/rows"
import { changeParts } from "./change-line"
import { type Section, type SectionId, sectionsOf } from "./list/sections"
import { useTones } from "../ui/theme"
import { ChangeTitleBar } from "./change-title"
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
  // the folder trek runs in, where treks are saved and stepped
  root?: string | undefined
  entries: TrekEntry[]
  // opens a trek in an editor, from its page
  onOpen: (entry: TrekEntry, editor: Editor) => void
  onQuit: () => void
  // where the change trek was started for stands; absent when there's none to show
  status?: TrekStatus | undefined
  // where the code as it is over the same repos stands: its ways in once found
  codeStatus?: TrekStatus | undefined
  // has the agent find the code's ways in; absent when no agent is set
  onFindWaysIn?: (() => void) | undefined
  // the way in trek's args asked for by name, and its trek
  asked?: AskedWayIn | undefined
  // which side trek's args asked for, selected as the screen opens
  focus?: HomeFocus | undefined
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
  // the editors treks can be stepped in here, the one chosen (none for the terminal), and what to
  // do when a place is picked
  editors?: readonly Editor[] | undefined
  editor?: Editor | undefined
  onChooseEditor?: ((place: StepPlace) => void) | undefined
  // the user's settings, shown and changed on the settings screen
  settings?: UserSettings | undefined
  onChangeSetting?: SettingChange | undefined
}

// The row trek's args asked for: the way in named, else the code's first row; none for the
// change, whose trek is selected anyway.
function focusKey(focus: HomeFocus | undefined, rows: readonly Row[]): string | undefined {
  if (focus?.kind !== "code") {
    return undefined
  }

  const named = focus.trigger === undefined ? undefined : `trigger:${focus.trigger}`
  const first = rows.find((row) => row.kind === "trigger" || row.kind === "ways-in")
  const firstKey = first === undefined ? undefined : itemKey({ kind: "row", row: first })
  return named ?? firstKey
}

// The list's rows: proposed repos, your changes, the code's ways in, and the saved treks.
const rowsFor = (props: Props) =>
  rowsOf(props.entries, props.codeStatus, props.proposals ?? [], props.asked, changeOpen(props))

// Whether the selected row is one of your changes', or there's none: where C picks another change.
const isOfChange = (row: Row | undefined, sections: readonly Section[]) =>
  row === undefined || sections.some((each) => each.id === "change" && each.rows.includes(row))

// Your changes and where their trek stands, for their own row, named as the title bar names them,
// else by their trek's name; none until where it stands is known.
function changeOpen(props: Props): ChangeOpen | undefined {
  const { summary, status } = props
  if (status === undefined) {
    return undefined
  }

  const named = summary === undefined ? [] : changeParts(summary).map((part) => part.text)
  const title = named.join("").replace(/^ · /, "")
  return {
    title: title === "" ? status.name : title,
    status,
    canBuild: props.onBuild !== undefined,
  }
}

export function App(props: Props) {
  const tones = useTones()
  const { onQuit, status } = props
  const rows = rowsFor(props)
  // the selected item by its key, so it stays put as rows move between sections; as it opens,
  // the side trek's args asked for
  const [chosen, setChosen] = useState<string | undefined>(() => focusKey(props.focus, rows))
  const [open, setOpen] = useState<ReadonlySet<SectionId>>(new Set())
  const [prompt, setPrompt] = useState<Prompt | undefined>(undefined)
  const [over, setOver] = useState<Over | undefined>(undefined)
  const help = useKeysHelp()
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

  const askLocation = (name: string) => setPrompt({ kind: "location", name })
  const opens = {
    build: (name: string) => setOver({ kind: "build", name }),
    trek: (name: string) => setOver({ kind: "trek", name }),
  }
  const rowActions = actionsFor(row, props, askLocation, opens)
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
    ["x", () => (dismiss ?? stop)?.()],
    ["?", help.show],
    ...moveKeys(move),
    ["return", () => pick?.()],
  ])
  const shifted = new Map([
    ["e", () => setPrompt({ kind: "editor" })],
    ["s", () => setOver("settings")],
    ["c", () => setOver("picker")],
  ])
  // While a prompt, settings, or the picker is open, keys go there, not to the list.
  const overlay = overlayFor(over, props, setOver)
  const onList = prompt === undefined && overlay === undefined
  useKeyboard(help.guard((key) => onList && listKey(key, actions, shifted)))

  const { width, height } = useTerminalDimensions()
  const choosesChange = props.choosing !== undefined && isOfChange(row, sections)
  // the line a pick still opening takes, over the list
  const room = listHeight(height, props.opening === undefined ? 0 : 1)
  const { start, end } = visibleWindow(lines.length, lineOfItem(lines, selected), room)
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
        <OpeningLine opening={props.opening} />
        <OrKeysHelp open={help.open} groups={HOME_GROUPS}>
          <box flexDirection="column" style={{ flexGrow: 1 }}>
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
        </OrKeysHelp>
      </box>
      <Bottom
        prompt={prompt}
        props={props}
        footer={
          <Footer
            keys={help.footer(keyHints(item, status, { ...rowActions, pick }, choosesChange))}
            shown={shown}
          />
        }
        close={() => setPrompt(undefined)}
      />
    </box>
  )
}
