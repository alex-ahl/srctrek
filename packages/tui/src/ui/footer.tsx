import { PADDING } from "./layout"
import { useTones } from "./theme"

/** A key and what it does, as the footer lists them. */
export type KeyHint = Readonly<{ key: string; does: string }>

/** Keys as a line of hints: "↑/↓ choose · enter pick · esc cancel". */
export function keysText(keys: readonly KeyHint[]): string {
  return keys.map(({ key, does }) => `${key} ${does}`).join(" · ")
}

/** The bottom line, ruled off above: the keys and what each does, dimmed. */
export function Footer({ keys, shown }: { keys: readonly KeyHint[]; shown: string }) {
  const tones = useTones()
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      border={["top"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={tones.dim}>{keysText(keys)}</text>
      <text fg={tones.dim}>{shown}</text>
    </box>
  )
}
