import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import type { TourEntry } from "./tour-list"

type Props = {
  entries: TourEntry[]
  onOpen: (entry: TourEntry) => void
  onQuit: () => void
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
    <box flexDirection="column" style={{ marginBottom: 1 }}>
      <text {...(selected ? { fg: "#7dd3fc" } : {})}>{`${selected ? "▶" : " "} ${title}`}</text>
      <text fg="#7a7f99">{`    ${entry.name} · ${describe(entry)}`}</text>
    </box>
  )
}

export function App({ entries, onOpen, onQuit }: Props) {
  const [selected, setSelected] = useState(0)
  useKeyboard((key) => {
    if (key.name === "q") onQuit()
    if (key.name === "down" || key.name === "j")
      setSelected((i) => Math.min(i + 1, entries.length - 1))
    if (key.name === "up" || key.name === "k") setSelected((i) => Math.max(i - 1, 0))
    const entry = entries[selected]
    if (key.name === "return" && entry?.valid) onOpen(entry)
  })
  return (
    <box flexDirection="column" style={{ border: true, padding: 1 }} title="codetrail">
      {entries.length === 0 ? (
        <text>No tours in .codetrail/tours. Press q to quit.</text>
      ) : (
        entries.map((entry, i) => (
          <TourRow key={entry.name} entry={entry} selected={i === selected} />
        ))
      )}
      <text fg="#7a7f99">↑/↓ choose · enter open in Neovim · q quit</text>
    </box>
  )
}
