import type { TourStatus } from "@codetrail/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useState } from "react"
import { ChangeStatus } from "./change-status"
import { rowsThatFit } from "./layout"
import { type Row, RowView, rowKey, rowsOf } from "./rows"
import type { TourEntry } from "./tour-list"
import { visibleWindow } from "./window"

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
}

type WithLog = Extract<TourStatus, { kind: "building" | "failed" }>

// A build's log is worth reading while it runs, and after it failed.
function hasLog(status: TourStatus | undefined): status is WithLog {
  return status?.kind === "building" || status?.kind === "failed"
}

// A build can start when the change has no tour yet, or its last build failed.
function canStartBuild(status: TourStatus | undefined): boolean {
  return status?.kind === "missing" || status?.kind === "failed"
}

// What enter does on a row: open a tour; on a trigger, open its tour or build it.
function pickAction(row: Row, entries: TourEntry[], props: Props): (() => void) | undefined {
  const { onOpen, onBuildTrigger } = props
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

function footerKeys(enter: string, canBuild: boolean, canShowLog: boolean): string {
  const build = canBuild ? " · b build" : ""
  const log = canShowLog ? " · l log" : ""

  return `↑/↓ choose · enter ${enter}${build}${log} · q quit`
}

// What enter says it does for the selected row.
function enterLabel(row: Row | undefined): string {
  const buildsTrigger = row?.kind === "trigger" && row.found.tour.kind !== "ready"

  return buildsTrigger ? "build its tour" : "open in Neovim"
}

export function App(props: Props) {
  const { entries, onQuit, status, onBuild, onShowLog } = props
  const rows = rowsOf(entries, status)
  const [chosen, setChosen] = useState<number | undefined>(undefined)

  // Until the user moves, the change's tour is the one picked out, once it's listed.
  const readyIndex = rows.findIndex(
    (row) => status?.kind === "ready" && row.kind === "tour" && row.entry.name === status.name,
  )
  const selected = chosen ?? Math.max(readyIndex, 0)
  const row = rows[selected]

  const pick = row === undefined ? undefined : pickAction(row, entries, props)
  const build = canStartBuild(status) ? onBuild : undefined
  const log = logName(row, status)
  const showLog = log !== undefined && onShowLog ? () => onShowLog(log) : undefined

  const moveDown = () => setChosen(Math.min(selected + 1, rows.length - 1))
  const moveUp = () => setChosen(Math.max(selected - 1, 0))
  const actions = new Map([
    ["q", onQuit],
    ["b", () => build?.()],
    ["l", () => showLog?.()],
    ["down", moveDown],
    ["j", moveDown],
    ["up", moveUp],
    ["k", moveUp],
    ["return", () => pick?.()],
  ])
  useKeyboard((key) => actions.get(key.name)?.())

  const { height } = useTerminalDimensions()
  const { start, end } = visibleWindow(rows.length, selected, rowsThatFit(height, status))
  const shown = end - start < rows.length ? `${start + 1}–${end} of ${rows.length} · ` : ""
  const keys = footerKeys(enterLabel(row), build !== undefined, showLog !== undefined)

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
      <text fg="#7a7f99">{`${shown}${keys}`}</text>
    </box>
  )
}
