import { TextAttributes } from "@opentui/core"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"

/** A key and what it does, as the footer lists them. */
export type KeyHint = Readonly<{ key: string; does: string }>

const SEPARATOR = "  ¦  "

const keyLabel = (key: string) => (key === "enter" ? "↵" : key)

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

/** The bottom line, ruled off above: the keys and what each does. */
export function Footer({ keys }: { keys: readonly KeyHint[] }) {
  const tones = useTones()
  return (
    <box
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <KeyHints keys={keys} />
    </box>
  )
}
