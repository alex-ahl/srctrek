import type { RGBA } from "@opentui/core"
import type { ReactNode } from "react"
import { COLOUR, useTones } from "./theme"

/** The selection's marker, where no band shows it: "▶ " on the selected line, else room for it. */
export function selectionMarker(selected: boolean, tint: RGBA | undefined): string {
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
 * when selected.
 */
export function Selectable({
  selected,
  tint,
  indent = "",
  children,
}: {
  selected: boolean
  tint: RGBA | undefined
  indent?: string
  children: ReactNode
}) {
  const tones = useTones()

  return (
    <Band selected={selected} tint={tint}>
      <text fg={COLOUR.text}>
        <span fg={tones.accent}>{`${indent}${selectionMarker(selected, tint)}`}</span>
        {children}
      </text>
    </Band>
  )
}
