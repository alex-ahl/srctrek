import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/react"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"

/** A key and what it does, as the footer lists them. */
export type KeyHint = Readonly<{ key: string; does: string }>

const SEPARATOR = "  ¦  "

const keyLabel = (key: string) => (key === "enter" ? "↵" : key)

/** Keys as a line of hints: "↑/↓ choose  ¦  ↵ pick  ¦  esc cancel". */
export function keysText(keys: readonly KeyHint[]): string {
  return keys.map(({ key, does }) => `${keyLabel(key)} ${does}`).join(SEPARATOR)
}

/** Keys as a line of hints, each key in the text's colour and bold, the rest dimmed. */
export function KeyHints({ keys }: { keys: readonly KeyHint[] }) {
  const tones = useTones()
  return (
    <text fg={tones.dim}>
      {keys.map(({ key, does }, at) => (
        <span key={key}>
          {at === 0 ? "" : SEPARATOR}
          <span fg={COLOUR.text} attributes={TextAttributes.BOLD}>
            {keyLabel(key)}
          </span>
          {` ${does}`}
        </span>
      ))}
    </text>
  )
}

// The gap kept between the keys and the count of rows shown.
const GAP = 2

/**
 * The bottom line, ruled off above: the keys and what each does, and how many rows are shown,
 * dimmed, when there's room for it beside the keys.
 */
export function Footer({ keys, shown }: { keys: readonly KeyHint[]; shown: string }) {
  const tones = useTones()
  const { width } = useTerminalDimensions()
  const fits = keysText(keys).length + GAP + shown.length <= width - 2 * PADDING
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <KeyHints keys={keys} />
      <text fg={tones.dim}>{shown === "" || !fits ? "" : `  ${shown}`}</text>
    </box>
  )
}
