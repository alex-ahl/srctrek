import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/react"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"

/** A key and what it does, as the footer lists them. */
export type KeyHint = Readonly<{ key: string; does: string }>

const SEPARATOR = "  ¦  "

const keyLabel = (key: string) => (key === "enter" ? "↵" : key)

// How wide the hints are drawn on one line.
const hintsWidth = (keys: readonly KeyHint[]) =>
  keys.map(({ key, does }) => `${keyLabel(key)}: ${does}`).join(SEPARATOR).length

/**
 * The hints that fit a line `width` wide: those before the last given up from the end first, so
 * the last, which lists every key or goes back, stays.
 */
export function fittingKeys(keys: readonly KeyHint[], width: number): readonly KeyHint[] {
  const before = keys.slice(0, -1)
  const last = keys.slice(-1)
  // the most of those before the last that fit beside it
  const kept = before.findLastIndex(
    (_, at) => hintsWidth([...before.slice(0, at + 1), ...last]) <= width,
  )
  return [...before.slice(0, kept + 1), ...last]
}

/** Keys as a line of hints, each key in the text's colour and bold, a colon and the rest dimmed. */
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
          {`: ${does}`}
        </span>
      ))}
    </text>
  )
}

/** The bottom line, ruled off above: the keys and what each does, as many as fit on it. */
export function Footer({ keys }: { keys: readonly KeyHint[] }) {
  const tones = useTones()
  const { width } = useTerminalDimensions()
  return (
    <box
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <KeyHints keys={fittingKeys(keys, width - 2 * PADDING)} />
    </box>
  )
}
