import type { ChangeSummary, ProposedRepo, TrekEntry, TrekState, TrekStatus } from "@srctrek/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useState } from "react"
import { ChangeStatus } from "./change-status"
import { Footer } from "./footer"
import { buildVerb, enterLabel, footerKeys } from "./footer-keys"
import { listHeight } from "./layout"
import { type Item, type ListLine, itemKey, itemsOf, lineOfItem, listLines } from "./list-lines"
import { ListLineView } from "./list-view"
import { LocationInput } from "./location-input"
import { type Row, columnsOf, rowsOf } from "./rows"
import { type SectionId, sectionsOf } from "./sections"
import { canStartBuild, hasLog, hasTrek } from "./states"
import { statusBlock } from "./status-block"
import { COLOUR } from "./theme"
import { TitleBar } from "./title-bar"
import { visibleWindow } from "./window"

type Action = (() => void) | undefined

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
  // where each saved trek stands against its branches, by name, as far as it's known yet
  states?: ReadonlyMap<string, TrekState> | undefined
  // the time "built today" is measured from; now, unless a test fixes it
  now?: Date | undefined
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

// What enter, b, l, and d do here, for the footer; only keys that do something are listed.
function keyHints(item: Item | undefined, status: TrekStatus | undefined, actions: RowActions) {
  const row = item?.kind === "row" ? item.row : undefined
  const enter = item?.kind === "fold" ? (item.open ? "hide" : "show") : enterLabel(row)

  return footerKeys(actions.pick === undefined ? undefined : enter, {
    build: actions.build === undefined ? undefined : buildVerb(status),
    log: actions.showLog !== undefined,
    dismiss: actions.dismiss !== undefined,
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

export function App(props: Props) {
  const { entries, onQuit, status, onBuild, onAddRepo } = props
  const rows = rowsOf(entries, status, props.proposals ?? [])
  // the selected item by its key, so it stays put as rows move between sections
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState<ReadonlySet<SectionId>>(new Set())
  // the proposed repo whose location the user is typing, while they are
  const [placing, setPlacing] = useState<string | undefined>(undefined)
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

  const rowActions = actionsFor(row, props, setPlacing)
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
  // While a location is typed, keys are text, not commands.
  useKeyboard((key) => placing === undefined && actions.get(key.name)?.())

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
  const context = { width, now, columns: columnsOf(visibleRows, status, states), status, states }

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <TitleBar summary={props.summary} />
      <box
        flexDirection="column"
        style={{ flexGrow: 1, paddingTop: 1, paddingLeft: 1, paddingRight: 1, overflow: "hidden" }}
      >
        {block !== undefined && (
          <box style={{ marginBottom: 1, flexShrink: 0 }}>
            <ChangeStatus block={block} />
          </box>
        )}
        {rows.length === 0 ? (
          <text fg={COLOUR.dim}>No treks in .srctrek/treks yet.</text>
        ) : (
          lines
            .slice(start, end)
            .map((line, i) => (
              <ListLineView key={start + i} line={line} selected={selected} context={context} />
            ))
        )}
      </box>
      {placing === undefined ? (
        <Footer keys={keyHints(item, status, { ...rowActions, pick })} shown={shown} />
      ) : (
        <LocationInput
          name={placing}
          onSubmit={(location) => {
            setPlacing(undefined)
            onAddRepo?.(placing, location)
          }}
          onCancel={() => setPlacing(undefined)}
        />
      )}
    </box>
  )
}
