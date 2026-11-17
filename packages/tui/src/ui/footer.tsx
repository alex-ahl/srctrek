import { useTerminalDimensions } from "@opentui/react"
import { PADDING } from "./layout"
import { useTones } from "./theme"

/** A key and what it does, as the footer lists them. */
export type KeyHint = Readonly<{ key: string; does: string }>

/** Keys as a line of hints: "↑/↓ choose · enter pick · esc cancel". */
export function keysText(keys: readonly KeyHint[]): string {
  return keys.map(({ key, does }) => `${key} ${does}`).join(" · ")
}

// The gap kept between the keys and the count of rows shown.
const GAP = 2

/**
 * The bottom line, ruled off above: the keys and what each does, dimmed, and how many rows are
 * shown, when there's room for it beside the keys.
 */
export function Footer({ keys, shown }: { keys: readonly KeyHint[]; shown: string }) {
  const tones = useTones()
  const { width } = useTerminalDimensions()
  const text = keysText(keys)
  const fits = text.length + GAP + shown.length <= width - 2 * PADDING
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={tones.dim}>{text}</text>
      <text fg={tones.dim}>{shown === "" || !fits ? "" : `  ${shown}`}</text>
    </box>
  )
}
