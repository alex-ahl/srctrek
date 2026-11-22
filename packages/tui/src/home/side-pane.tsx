import { TextAttributes } from "@opentui/core"
import type { Heading, PaneLine } from "./heading"
import { wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

/** The pane's width beside the list, its divider included. */
export const PANE_WIDTH = 38

// A pane line wrapped to the pane, each piece in the line's tone.
function Lines({ line, room }: { line: PaneLine; room: number }) {
  const tones = useTones()
  const pieces = line.text === "" ? [""] : wrap(line.text, room)
  return (
    <>
      {pieces.map((piece, i) => (
        // never shrunk, so a pane too long for the screen is cut at its foot, not in its middle
        <text
          key={i}
          style={{ flexShrink: 0 }}
          fg={line.tone === undefined ? COLOUR.text : tones[line.tone]}
          {...(line.italic === true ? { attributes: TextAttributes.ITALIC } : {})}
        >
          {piece === "" ? " " : piece}
        </text>
      ))}
    </>
  )
}

/**
 * The selected row described beside the list, behind a divider: a dim line saying what it is, then
 * what the row doesn't show. It never moves the list, and has no keys: those are in the footer.
 */
export function SidePane({ heading }: { heading: Heading }) {
  const tones = useTones()
  const room = PANE_WIDTH - 3

  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={tones.dim}
      style={{ width: PANE_WIDTH, flexShrink: 0, paddingLeft: 1, overflow: "hidden" }}
    >
      <text fg={tones.dim}>{heading.label}</text>
      <text> </text>
      {heading.lines.map((line, i) => (
        <Lines key={i} line={line} room={room} />
      ))}
    </box>
  )
}

/** On a terminal too narrow for the pane: what the selected row is, and its first line, over the footer. */
export function SideLine({ heading, width }: { heading: Heading; width: number }) {
  const tones = useTones()
  const first = heading.lines.find((line) => line.text !== "")?.text
  const text = first === undefined ? heading.label : `${heading.label} · ${first}`
  return <text fg={tones.dim}>{text.slice(0, Math.max(0, width))}</text>
}
