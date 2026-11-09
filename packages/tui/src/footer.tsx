import { COLOUR } from "./theme"

/** A key and what it does, as the footer lists them. */
export type KeyHint = Readonly<{ key: string; does: string }>

/** The bottom line, ruled off above: the keys, each in the text colour with what it does dimmed. */
export function Footer({ keys, shown }: { keys: readonly KeyHint[]; shown: string }) {
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      border={["top"]}
      borderColor={COLOUR.dim}
      style={{ paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}
    >
      <text fg={COLOUR.dim}>
        {keys.map(({ key, does }, i) => (
          <span key={key}>
            {i === 0 ? "" : " · "}
            <span fg={COLOUR.text}>{key}</span>
            {` ${does}`}
          </span>
        ))}
      </text>
      <text fg={COLOUR.dim}>{shown}</text>
    </box>
  )
}
