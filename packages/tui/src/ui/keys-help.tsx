import { type KeyEvent, TextAttributes } from "@opentui/core"
import { type ReactNode, useState } from "react"
import type { KeyHint } from "./footer"
import { COLOUR, useTones } from "./theme"

/** Keys listed together under a heading, in the panel `?` opens. */
export type KeyGroup = Readonly<{ title: string; keys: readonly KeyHint[] }>

/** The hint every footer ends with, for the keys it leaves out. */
export const HELP_HINT: KeyHint = { key: "?", does: "keys" }

/** The footer while the panel is open: any key closes it. */
export const HELP_KEYS: readonly KeyHint[] = [{ key: "any key", does: "close" }]

/**
 * The keys panel's state: `show` opens it; while open, `guard` lets any key close it and go no
 * further, and `footer` says so.
 */
export function useKeysHelp() {
  const [open, setOpen] = useState(false)
  return {
    open,
    show: () => setOpen(true),
    guard:
      (handle: (key: KeyEvent) => void) =>
      (key: KeyEvent): void =>
        open ? setOpen(false) : handle(key),
    footer: (keys: readonly KeyHint[]) => (open ? HELP_KEYS : keys),
  }
}

/** The screen's body, or every key of the screen in its place while the panel is open. */
export function OrKeysHelp({
  open,
  groups,
  children,
}: {
  open: boolean
  groups: readonly KeyGroup[]
  children: ReactNode
}) {
  return open ? <KeysHelp groups={groups} /> : children
}

/** Every key of a screen, grouped, in place of its body; any key closes it. */
export function KeysHelp({ groups }: { groups: readonly KeyGroup[] }) {
  const tones = useTones()
  const width = Math.max(...groups.flatMap((group) => group.keys.map((hint) => hint.key.length)))

  return (
    <box flexDirection="column">
      {groups.map((group) => (
        <box key={group.title} flexDirection="column" style={{ marginBottom: 1 }}>
          <text fg={tones.dim}>{group.title.toUpperCase()}</text>
          {group.keys.map((hint) => (
            <text key={hint.key}>
              <span fg={COLOUR.text} attributes={TextAttributes.BOLD}>
                {`  ${hint.key.padEnd(width)}`}
              </span>
              <span fg={COLOUR.text}>{`   ${hint.does}`}</span>
            </text>
          ))}
        </box>
      ))}
    </box>
  )
}
