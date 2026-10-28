import type { TourStatus } from "@codetrail/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useState } from "react"
import { ChangeStatus } from "./change-status"
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
}

// A tour takes three lines: its title, its name and steps, and a gap.
const ROW_LINES = 3

// Lines spent on anything but tours: the frame's border and padding, the footer, and the
// status with its gap (two lines, in case it wraps; a failed build adds its log's lines).
function chromeLines(status: TourStatus | undefined): number {
  const frameAndFooter = 5
  if (status === undefined) {
    return frameAndFooter
  }

  const statusLines = status.kind === "failed" ? 2 + status.logTail.length : 2
  return frameAndFooter + statusLines + 1
}

// A build can start when the change has no tour yet, or its last build failed.
function canStartBuild(status: TourStatus | undefined): boolean {
  return status?.kind === "missing" || status?.kind === "failed"
}

function describe(entry: TourEntry): string {
  if (!entry.valid) {
    return `invalid: ${entry.problem}`
  }

  const flags = entry.highFlags > 0 ? `  ⚠ ${entry.highFlags} high` : ""
  return `${entry.steps} steps${flags}`
}

function TourRow({ entry, selected }: { entry: TourEntry; selected: boolean }) {
  const title = entry.valid ? entry.title : entry.name
  return (
    <box flexDirection="column" style={{ marginBottom: 1, flexShrink: 0 }}>
      <text {...(selected ? { fg: "#7dd3fc" } : {})}>{`${selected ? "▶" : " "} ${title}`}</text>
      <text fg="#7a7f99">{`    ${entry.name} · ${describe(entry)}`}</text>
    </box>
  )
}

export function App({ entries, onOpen, onQuit, status, onBuild }: Props) {
  const [chosen, setChosen] = useState<number | undefined>(undefined)

  // Until the user moves, the change's tour is the one picked out, once it's listed.
  const readyIndex =
    status?.kind === "ready" ? entries.findIndex((e) => e.name === status.name) : -1
  const selected = chosen ?? Math.max(readyIndex, 0)

  const moveDown = () => setChosen(Math.min(selected + 1, entries.length - 1))
  const moveUp = () => setChosen(Math.max(selected - 1, 0))
  const openSelected = () => {
    const entry = entries[selected]
    if (entry?.valid) {
      onOpen(entry)
    }
  }

  const build = onBuild !== undefined && canStartBuild(status) ? onBuild : undefined

  const actions = new Map([
    ["q", onQuit],
    ["b", () => build?.()],
    ["down", moveDown],
    ["j", moveDown],
    ["up", moveUp],
    ["k", moveUp],
    ["return", openSelected],
  ])
  useKeyboard((key) => actions.get(key.name)?.())

  const { height } = useTerminalDimensions()
  const fits = Math.max(1, Math.floor((height - chromeLines(status)) / ROW_LINES))
  const { start, end } = visibleWindow(entries.length, selected, fits)
  const shown = end - start < entries.length ? `${start + 1}–${end} of ${entries.length} · ` : ""
  const keys = `↑/↓ choose · enter open in Neovim${build ? " · b build" : ""} · q quit`

  return (
    <box flexDirection="column" style={{ border: true, padding: 1 }} title="codetrail">
      {status !== undefined && (
        <box style={{ marginBottom: 1, flexShrink: 0 }}>
          <ChangeStatus status={status} canBuild={onBuild !== undefined} />
        </box>
      )}
      <box flexDirection="column" style={{ flexGrow: 1, overflow: "hidden" }}>
        {entries.length === 0 ? (
          <text>No tours in .codetrail/tours. Press q to quit.</text>
        ) : (
          entries
            .slice(start, end)
            .map((entry, i) => (
              <TourRow key={entry.name} entry={entry} selected={start + i === selected} />
            ))
        )}
      </box>
      <text fg="#7a7f99">{`${shown}${keys}`}</text>
    </box>
  )
}
