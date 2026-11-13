import { TextAttributes } from "@opentui/core"
import type { ReactNode } from "react"
import { PADDING } from "./layout"
import { COLOUR, useTones } from "./theme"

const NAME = "srctrek"
const SEPARATOR = " › "

/** How much of a terminal `width` wide is left on the title bar's left after "srctrek › ". */
export function titleRoom(width: number): number {
  return width - 2 * PADDING - NAME.length - SEPARATOR.length
}

/**
 * The top line of every screen: srctrek, then what the screen is about after a "›", and anything
 * on the right, dimmed; ruled off below.
 */
export function TitleBar({ left, right }: { left?: ReactNode; right?: string }) {
  const tones = useTones()

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      border={["bottom"]}
      borderColor={tones.dim}
      style={{ paddingLeft: PADDING, paddingRight: PADDING, flexShrink: 0 }}
    >
      <text fg={COLOUR.text}>
        <span attributes={TextAttributes.BOLD}>{NAME}</span>
        {left !== undefined && <span fg={tones.dim}>{SEPARATOR}</span>}
        {left}
      </text>
      {right !== undefined && right !== "" && <text fg={tones.dim}>{right}</text>}
    </box>
  )
}
