import { useTerminalDimensions } from "@opentui/react"
import { PADDING } from "./layout"
import { useTones } from "./theme"

/** A key and what it does, as the footer lists them, and what it holds now, in the accent. */
export type KeyHint = Readonly<{ key: string; does: string; mark?: string }>

const hintText = ({ key, does }: KeyHint) => `${key} ${does}`

const markText = ({ mark }: KeyHint) => (mark === undefined ? "" : ` · ${mark}`)

const SEPARATOR = " · "

/** Keys as a line of hints: "↑/↓ choose · enter pick · esc cancel". */
export function keysText(keys: readonly KeyHint[]): string {
  return keys.map((hint) => hintText(hint) + markText(hint)).join(SEPARATOR)
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
      <text fg={tones.dim}>
        {keys.map((hint, at) => (
          <span key={hint.key}>
            {at === 0 ? "" : SEPARATOR}
            {hintText(hint)}
            <span fg={tones.accent}>{markText(hint)}</span>
          </span>
        ))}
      </text>
      <text fg={tones.dim}>{shown === "" || !fits ? "" : `  ${shown}`}</text>
    </box>
  )
}
