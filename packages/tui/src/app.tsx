import type {
  BranchChoices,
  ChangeChoice,
  ChangeSummary,
  OpenPullRequest,
  ProposedRepo,
  Settings as UserSettings,
  TrekEntry,
  TrekState,
  TrekStatus,
} from "@srctrek/core"
import type { RGBA } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { type ReactNode, useState } from "react"
import { ChangePicker } from "./change-picker"
import { ChangeStatus } from "./change-status"
import { EditorPicker } from "./editor-picker"
import { type SettingChange, SettingsScreen } from "./settings-screen"
import type { Editor } from "./editors"
import { Footer } from "./footer"
import { buildVerb, enterLabel, footerKeys } from "./footer-keys"
import { PADDING, listHeight } from "./layout"
import { type Item, type ListLine, itemKey, itemsOf, lineOfItem, listLines } from "./list-lines"
import { ListLineView } from "./list-view"
import { TextPrompt } from "./text-prompt"
import { columnsOf } from "./row-columns"
import { type Row, rowsOf } from "./rows"
import { type SectionId, sectionsOf } from "./sections"
import { canStartBuild, hasLog, hasTrek } from "./states"
import { statusBlock } from "./status-block"
import { useTones } from "./theme"
import { TitleBar } from "./title-bar"
import { visibleWindow } from "./window"

type Action = (() => void) | undefined

/**
 * What the change picker needs: the change chosen now, the changes to offer, where each one's
 * trek stands, and the pick.
 */
export type Choosing = Readonly<{
  choice: ChangeChoice
  load: () => Promise<BranchChoices>
  pullRequests: () => Promise<OpenPullRequest[]>
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  onPick: (choice: ChangeChoice) => void
}>

type Props = {
  entries: TrekEntry[]
  onOpen: (entry: TrekEntry) => void
  onQuit: () => void
  // where the change trek was started for stands; absent when there's none to show
  status?: TrekStatus | undefined
  // starts building the change's trek; absent when no agent is set
  onBuild?: (() => void) | undefined
  // starts building the trek of a trigger found in the code; absent when no agent is set
  onBuildTrigger?: ((trigger: string) => void) | undefined
  // shows the full log of the build with this name
  onShowLog?: ((name: string) => void) | undefined
  // repos the agent proposed adding to the repos list, each added or dismissed by the user;
  // added at the location the user gives when the agent found none
  proposals?: ProposedRepo[] | undefined
  onAddRepo?: ((name: string, location?: string) => void) | undefined
  onDismissRepo?: ((name: string) => void) | undefined
  // what the change is, for the title bar; absent when trek was started without one
  summary?: ChangeSummary | undefined
  // the change chosen, the changes to choose from, and what picking one does; absent, C does nothing
  choosing?: Choosing | undefined
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

// Enter on a proposed repo adds it, or first asks where it lives when the agent didn't say.
function addAction(proposal: ProposedRepo, props: Props, askLocation: (name: string) => void) {
  const { onAddRepo } = props
  if (onAddRepo === undefined) {
    return undefined
  }

  const { name, source } = proposal
  return source === undefined ? () => askLocation(name) : () => onAddRepo(name)
}

// A trek opens unless it isn't valid, or it's the change's trek and names a repo not here.
function opens(entry: TrekEntry, status: TrekStatus | undefined): boolean {
  const unreachable = status?.kind === "unreachable" && status.name === entry.name

  return entry.valid && !unreachable
}

// What enter does on a row: add a proposed repo; open a trek; on a trigger, open its trek or
// build it.
function pickAction(row: Row, props: Props, askLocation: (name: string) => void): Action {
  const { entries, onOpen, onBuildTrigger } = props
  if (row.kind === "proposal") {
    return addAction(row.proposal, props, askLocation)
  }

  if (row.kind === "trek") {
    return opens(row.entry, props.status) ? () => onOpen(row.entry) : undefined
  }

  const { trigger, trek } = row.found
  if (hasTrek(trek)) {
    const entry = entries.find((e) => e.name === trek.name)
    return entry?.valid ? () => onOpen(entry) : undefined
  }

  return canStartBuild(trek) && onBuildTrigger ? () => onBuildTrigger(trigger.name) : undefined
}

// Whose build log l shows: the selected trigger's, when it has one, else the change's.
function logName(row: Row | undefined, status: TrekStatus | undefined): string | undefined {
  if (row?.kind === "trigger" && hasLog(row.found.trek)) {
    return row.found.trek.name
  }

  return hasLog(status) ? status.name : undefined
}

// What each key does on the selected row; undefined where it does nothing.
type RowActions = { pick: Action; build: Action; showLog: Action; dismiss: Action }

function dismissAction(row: Row | undefined, onDismissRepo: Props["onDismissRepo"]): Action {
  if (row?.kind !== "proposal" || onDismissRepo === undefined) {
    return undefined
  }

  const { name } = row.proposal
  return () => onDismissRepo(name)
}

function actionsFor(
  row: Row | undefined,
  props: Props,
  askLocation: (name: string) => void,
): RowActions {
  const { status, onBuild, onShowLog } = props
  const log = logName(row, status)

  return {
    pick: row === undefined ? undefined : pickAction(row, props, askLocation),
    build: canStartBuild(status) ? onBuild : undefined,
    showLog: log !== undefined && onShowLog ? () => onShowLog(log) : undefined,
    dismiss: dismissAction(row, props.onDismissRepo),
  }
}

// "3–22 of 35": which items are on screen, when not all of them are.
function shownItems(visible: readonly ListLine[], total: number): string {
  const indexes = visible.flatMap((line) => (line.kind === "item" ? [line.index] : []))
  const [first, last] = [indexes.at(0), indexes.at(-1)]
  if (first === undefined || last === undefined || indexes.length === total) {
    return ""
  }

  return `${first + 1}–${last + 1} of ${total}`
}

// A change other than the user's own branch, picked on screen or named by trek's arguments.
function isPicked(choosing: Choosing | undefined): boolean {
  return choosing !== undefined && choosing.choice.kind !== "own"
}

// What enter, b, l, d, and C do here, for the footer; only keys that do something are listed.
function keyHints(
  item: Item | undefined,
  status: TrekStatus | undefined,
  actions: RowActions,
  props: Props,
) {
  const { editor } = props
  const row = item?.kind === "row" ? item.row : undefined
  const enter = item?.kind === "fold" ? (item.open ? "hide" : "show") : enterLabel(row, editor)

  return footerKeys(actions.pick === undefined ? undefined : enter, {
    build: actions.build === undefined ? undefined : buildVerb(status),
    log: actions.showLog !== undefined,
    dismiss: actions.dismiss !== undefined,
    change: props.choosing !== undefined,
  })
}

// The section opened if closed, closed if open.
function toggled(open: ReadonlySet<SectionId>, id: SectionId): ReadonlySet<SectionId> {
  return open.has(id) ? new Set([...open].filter((each) => each !== id)) : new Set([...open, id])
}

// Until the user moves, the change's trek is the one picked out, once it's listed; else the first.
function defaultKey(items: readonly Item[], status: TrekStatus | undefined): string | undefined {
  const change = hasTrek(status) ? `trek:${status?.name}` : undefined
  const keys = items.map(itemKey)

  return keys.find((key) => key === change) ?? keys[0]
}

// Which item is selected: the one the user chose while it's still listed, else the default.
function selectedIndex(
  items: readonly Item[],
  chosen: string | undefined,
  status: TrekStatus | undefined,
) {
  const keys = items.map(itemKey)
  const found = chosen === undefined ? -1 : keys.indexOf(chosen)
  if (found !== -1) {
    return found
  }

  return Math.max(0, keys.indexOf(defaultKey(items, status) ?? ""))
}

// What enter does: open or close a fold, else what it does on the row.
function pickFor(item: Item | undefined, onRow: Action, fold: (id: SectionId) => void): Action {
  if (item?.kind !== "fold") {
    return onRow
  }

  const { id } = item.section
  return () => fold(id)
}

// A key on the list: E or S, with shift, opens the editor picker or settings; any other does
// its action.
function listKey(
  key: { name: string; shift: boolean },
  actions: ReadonlyMap<string, () => void>,
  shifted: ReadonlyMap<string, () => void>,
) {
  const action = key.shift ? shifted.get(key.name) : actions.get(key.name)
  action?.()
}

// What the bottom of the screen is asking, when it's asking: where a proposed repo lives, or which
// editor treks open in, with the trek to open once it's picked.
type Prompt = { kind: "location"; name: string } | { kind: "editor"; then?: TrekEntry | undefined }

// The bottom of the screen: the prompt that's open, else the footer.
function Bottom({
  prompt,
  props,
  footer,
  close,
}: {
  prompt: Prompt | undefined
  props: Props
  footer: ReactNode
  close: () => void
}) {
  if (prompt === undefined) {
    return footer
  }

  if (prompt.kind === "location") {
    const { name } = prompt
    const add = (location: string) => {
      close()
      props.onAddRepo?.(name, location)
    }
    const question = `Where does ${name} live? A path or URL, esc to cancel:`
    return <TextPrompt question={question} onSubmit={add} onCancel={close} />
  }

  const { then } = prompt
  const pick = (editor: Editor) => {
    close()
    props.onChooseEditor?.(editor)
    if (then !== undefined) {
      props.onOpen(then)
    }
  }

  return (
    <EditorPicker
      editors={props.editors ?? []}
      current={props.editor}
      onPick={pick}
      onCancel={close}
    />
  )
}

// The change picker, over the list; picking closes it and reopens the home screen on the pick.
function Picker({
  choosing,
  tint,
  close,
}: {
  choosing: Choosing
  tint: RGBA | undefined
  close: () => void
}) {
  const pick = (choice: ChangeChoice) => {
    close()
    choosing.onPick(choice)
  }

  return (
    <ChangePicker
      choice={choosing.choice}
      load={choosing.load}
      pullRequests={choosing.pullRequests}
      status={choosing.status}
      onPick={pick}
      onBack={close}
      tint={tint}
    />
  )
}

// What can open over the list, which keeps its selection for when it closes.
type Over = "settings" | "picker"

// The screen open over the list, if any: the picker only where there's a change to choose.
function overlayFor(over: Over | undefined, props: Props, close: () => void): ReactNode {
  if (over === "settings") {
    return <Settings props={props} close={close} />
  }

  if (over !== "picker" || props.choosing === undefined) {
    return undefined
  }

  return <Picker choosing={props.choosing} tint={props.tint} close={close} />
}

// The settings screen, over the list.
function Settings({ props, close }: { props: Props; close: () => void }) {
  return (
    <SettingsScreen
      settings={props.settings ?? {}}
      editors={props.editors ?? []}
      editor={props.editor}
      onChange={(key, value) => props.onChangeSetting?.(key, value)}
      onBack={close}
      tint={props.tint}
    />
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
  // when the screen opened, which "built today" is measured from
  const [now] = useState(() => props.now ?? new Date())

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
  const rowActions = actionsFor(row, { ...props, onOpen }, askLocation)
  const pick = pickFor(item, rowActions.pick, (id) => setOpen(toggled(open, id)))
  const { build, showLog, dismiss } = rowActions

  const moveTo = (index: number) => setChosen(keys[Math.min(Math.max(index, 0), keys.length - 1)])
  const actions = new Map([
    ["q", onQuit],
    ["b", () => build?.()],
    ["l", () => showLog?.()],
    ["d", () => dismiss?.()],
    ["down", () => moveTo(selected + 1)],
    ["j", () => moveTo(selected + 1)],
    ["up", () => moveTo(selected - 1)],
    ["k", () => moveTo(selected - 1)],
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
    status === undefined ? undefined : statusBlock(status, changeEntry, onBuild !== undefined)
  const { start, end } = visibleWindow(
    lines.length,
    lineOfItem(lines, selected),
    listHeight(height, block),
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
      <TitleBar summary={props.summary} picked={isPicked(props.choosing)} />
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
        {block !== undefined && (
          <box style={{ marginBottom: 1, flexShrink: 0 }}>
            <ChangeStatus block={block} />
          </box>
        )}
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
          <Footer keys={keyHints(item, status, { ...rowActions, pick }, props)} shown={shown} />
        }
        close={() => setPrompt(undefined)}
      />
    </box>
  )
}
