import { TextAttributes } from "@opentui/core"
import type { Heading } from "./heading"
import { wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { useStateText } from "../ui/turning"

/** The pane's width beside the list, its divider included. */
export const PANE_WIDTH = 38

// The block's state, in its colour and turning while it builds.
function StateLine({ heading }: { heading: Heading }) {
  const tones = useTones()
  const block = heading.block
  const state = useStateText(block)
  return block === undefined ? null : <text fg={tones[block.tone]}>{state}</text>
}

// What the block names: its name in bold, wrapped, what it holds, and a likely-wrong count.
function NameLines({ heading, room }: { heading: Heading; room: number }) {
  const tones = useTones()
  const { block } = heading
  if (block === undefined) {
    return null
  }

  return (
    <>
      {(block.name === undefined ? [] : wrap(block.name, room)).map((line, i) => (
        <text key={i} fg={COLOUR.text} attributes={TextAttributes.BOLD}>
          {line}
        </text>
      ))}
      {block.holds !== undefined && <text fg={tones.dim}>{block.holds}</text>}
      {block.flag !== undefined && <text fg={tones.bad}>{block.flag}</text>}
    </>
  )
}

// What it's of, then why, after a gap: the dim lines under the name.
function AboutLines({ heading, room }: { heading: Heading; room: number }) {
  const tones = useTones()
  const details = heading.block?.details ?? []
  return (
    <>
      {wrap(heading.about ?? "", room).map((line, i) => (
        <text key={`about-${String(i)}`} fg={tones.dim}>
          {line}
        </text>
      ))}
      {details.length > 0 && <text> </text>}
      {details
        .flatMap((detail) => wrap(detail, room))
        .map((line, i) => (
          <text key={`detail-${String(i)}`} fg={tones.dim} attributes={TextAttributes.ITALIC}>
            {line}
          </text>
        ))}
    </>
  )
}

/**
 * The selected row described beside the list, behind a divider: a dim line saying what it is,
 * where it stands, its name, what it holds and is of, and why. It never moves the list, and has no
 * keys: those are in the footer.
 */
export function SidePane({ heading }: { heading: Heading }) {
  const tones = useTones()
  const room = PANE_WIDTH - 3

  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={tones.dim}
      style={{ width: PANE_WIDTH, flexShrink: 0, paddingLeft: 1 }}
    >
      <text fg={tones.dim}>{heading.label}</text>
      <text> </text>
      <StateLine heading={heading} />
      <NameLines heading={heading} room={room} />
      <AboutLines heading={heading} room={room} />
    </box>
  )
}

/** On a terminal too narrow for the pane: the selected row on one dim line over the footer. */
export function SideLine({ heading, width }: { heading: Heading; width: number }) {
  const tones = useTones()
  const { block } = heading
  const parts = [
    heading.label,
    block === undefined ? undefined : `${block.symbol} ${block.state}`,
    block?.name,
  ]
  const text = parts.filter((part) => part !== undefined).join(" · ")
  return <text fg={tones.dim}>{text.slice(0, Math.max(0, width))}</text>
}
