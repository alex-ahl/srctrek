import type { ProposedRepo, TourStatus } from "@codetrail/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useState } from "react"
import { ChangeStatus } from "./change-status"
import { rowsThatFit } from "./layout"
import { type Row, RowView, rowKey, rowsOf } from "./rows"
import type { TourEntry } from "./tour-list"
import { LocationInput } from "./location-input"
import { visibleWindow } from "./window"

type Action = (() => void) | undefined

type Props = {
  entries: TourEntry[]
  onOpen: (entry: TourEntry) => void
  onQuit: () => void
  // where the change trail was started for stands; absent when there's none to show
  status?: TourStatus | undefined
  // starts building the change's tour; absent when no agent is set
  onBuild?: (() => void) | undefined
  // starts building the tour of a trigger found in the code; absent when no agent is set
  onBuildTrigger?: ((trigger: string) => void) | undefined
  // shows the full log of the build with this name
  onShowLog?: ((name: string) => void) | undefined
  // repos the agent proposed adding to the repos list, each added or dismissed by the user;
  // added at the location the user gives when the agent found none
  proposals?: ProposedRepo[] | undefined
  onAddRepo?: ((name: string, location?: string) => void) | undefined
  onDismissRepo?: ((name: string) => void) | undefined
}

type WithLog = Extract<TourStatus, { kind: "building" | "failed" }>

// A build's log is worth reading while it runs, and after it failed.
function hasLog(status: TourStatus | undefined): status is WithLog {
  return status?.kind === "building" || status?.kind === "failed"
}

// A build can start when the change has no tour yet, its last build failed, or its tour is out
// of date and can be updated.
function canStartBuild(status: TourStatus | undefined): boolean {
  return status?.kind === "missing" || status?.kind === "failed" || status?.kind === "stale"
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

// What enter does on a row: add a proposed repo; open a tour; on a trigger, open its tour or
// build it.
function pickAction(row: Row, props: Props, askLocation: (name: string) => void): Action {
  const { entries, onOpen, onBuildTrigger } = props
  if (row.kind === "proposal") {
    return addAction(row.proposal, props, askLocation)
  }

  if (row.kind === "tour") {
    return row.entry.valid ? () => onOpen(row.entry) : undefined
  }

  const { trigger, tour } = row.found
  if (tour.kind === "ready") {
    const entry = entries.find((e) => e.name === tour.name)
    return entry?.valid ? () => onOpen(entry) : undefined
  }

  return canStartBuild(tour) && onBuildTrigger ? () => onBuildTrigger(trigger.name) : undefined
}

// Whose build log l shows: the selected trigger's, when it has one, else the change's.
function logName(row: Row | undefined, status: TourStatus | undefined): string | undefined {
  if (row?.kind === "trigger" && hasLog(row.found.tour)) {
    return row.found.tour.name
  }

  return hasLog(status) ? status.name : undefined
}

// What b does, when it does anything: "build" a tour, or "update" an out-of-date one.
type Offered = { build: string | undefined; log: boolean; dismiss: boolean }

function buildVerb(status: TourStatus | undefined): string {
  return status?.kind === "stale" ? "update" : "build"
}

function footerKeys(enter: string, offered: Offered): string {
  const build = offered.build === undefined ? "" : ` · b ${offered.build}`
  const log = offered.log ? " · l log" : ""
  const dismiss = offered.dismiss ? " · d dismiss" : ""

  return `↑/↓ choose · enter ${enter}${dismiss}${build}${log} · q quit`
}

// What enter says it does for the selected row.
function enterLabel(row: Row | undefined): string {
  if (row?.kind === "proposal") {
    return "add to the repos list"
  }

  const buildsTrigger = row?.kind === "trigger" && row.found.tour.kind !== "ready"

  return buildsTrigger ? "build its tour" : "open in Neovim"
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

export function App(props: Props) {
  const { entries, onQuit, status, onBuild, onAddRepo } = props
  const rows = rowsOf(entries, status, props.proposals ?? [])
  const [chosen, setChosen] = useState<number | undefined>(undefined)
  // the proposed repo whose location the user is typing, while they are
  const [placing, setPlacing] = useState<string | undefined>(undefined)

  // Until the user moves, the change's tour is the one picked out, once it's listed.
  const readyIndex = rows.findIndex(
    (row) => status?.kind === "ready" && row.kind === "tour" && row.entry.name === status.name,
  )
  const selected = chosen ?? Math.max(readyIndex, 0)
  const row = rows[selected]

  const { pick, build, showLog, dismiss } = actionsFor(row, props, setPlacing)

  const moveDown = () => setChosen(Math.min(selected + 1, rows.length - 1))
  const moveUp = () => setChosen(Math.max(selected - 1, 0))
  const actions = new Map([
    ["q", onQuit],
    ["b", () => build?.()],
    ["l", () => showLog?.()],
    ["d", () => dismiss?.()],
    ["down", moveDown],
    ["j", moveDown],
    ["up", moveUp],
    ["k", moveUp],
    ["return", () => pick?.()],
  ])
  // While a location is typed, keys are text, not commands.
  useKeyboard((key) => placing === undefined && actions.get(key.name)?.())

  const { height } = useTerminalDimensions()
  const { start, end } = visibleWindow(rows.length, selected, rowsThatFit(height, status))
  const shown = end - start < rows.length ? `${start + 1}–${end} of ${rows.length} · ` : ""
  const keys = footerKeys(enterLabel(row), {
    build: build === undefined ? undefined : buildVerb(status),
    log: showLog !== undefined,
    dismiss: dismiss !== undefined,
  })

  return (
    <box flexDirection="column" style={{ border: true, padding: 1 }} title="codetrail">
      {status !== undefined && (
        <box style={{ marginBottom: 1, flexShrink: 0 }}>
          <ChangeStatus status={status} canBuild={onBuild !== undefined} />
        </box>
      )}
      <box flexDirection="column" style={{ flexGrow: 1, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <text>No tours in .codetrail/tours. Press q to quit.</text>
        ) : (
          rows
            .slice(start, end)
            .map((shownRow, i) => (
              <RowView key={rowKey(shownRow)} row={shownRow} selected={start + i === selected} />
            ))
        )}
      </box>
      {placing === undefined ? (
        <text fg="#7a7f99">{`${shown}${keys}`}</text>
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
