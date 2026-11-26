import type { RGBA } from "@opentui/core"
import type { ReactNode } from "react"
import { COLOUR, useTones } from "./theme"

/** The selection's marker, where no band shows it: "▶ " on the selected line, else room for it. */
function selectionMarker(selected: boolean, tint: RGBA | undefined): string {
  return selected && tint === undefined ? "▶ " : "  "
}

/**
 * A line on the band when it's selected and the terminal's colours are known, so the band can be
 * mixed from them; as it is otherwise.
 */
export function Band({
  selected,
  tint,
  children,
}: {
  selected: boolean
  tint: RGBA | undefined
  children: ReactNode
}) {
  return selected && tint !== undefined ? (
    <box style={{ backgroundColor: tint }}>{children}</box>
  ) : (
    children
  )
}

/**
 * One line of a list that can be selected: the marker after `indent`, then the line, on the band
 * when selected; with an `edge`, the selected line's marker is an edge in its colour.
 */
export function Selectable({
  selected,
  tint,
  indent = "",
  edge,
  children,
}: {
  selected: boolean
  tint: RGBA | undefined
  indent?: string
  edge?: RGBA | undefined
  children: ReactNode
}) {
  const tones = useTones()
  const marker = selected && edge !== undefined ? "▌ " : selectionMarker(selected, tint)

  return (
    <Band selected={selected} tint={tint}>
      <text fg={COLOUR.text}>
        <span fg={edge ?? tones.accent}>{`${indent}${marker}`}</span>
        {children}
      </text>
    </Band>
  )
}
