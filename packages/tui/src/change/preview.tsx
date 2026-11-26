import { TextAttributes } from "@opentui/core"
import type { FlaggedStep, OverviewView } from "@srctrek/core"
import { SEPARATOR } from "../ui/separator"
import { wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

// Prose kept to a line a reader takes in at once, on however wide a terminal.
const PROSE_MOST = 80

// The labels' room, so the trigger's text and the outcome's start in one column.
const LABEL = "Outcome, predicted"

// Likely-wrong steps named in full; past them, how many more.
const FLAGS_SHOWN = 2

// "▶ Trigger   …": a glyph in the accent, the label dimmed, and the text wrapped under itself.
function End(props: { glyph: string; label: string; text: string; width: number }) {
  const tones = useTones()
  const indent = 2 + LABEL.length + 3
  return (
    <>
      {wrap(props.text, Math.min(props.width, PROSE_MOST + indent) - indent).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          {i === 0 ? (
            <span>
              <span fg={tones.accent}>{`${props.glyph} `}</span>
              <span fg={tones.dim}>{props.label.padEnd(indent - 2)}</span>
            </span>
          ) : (
            " ".repeat(indent)
          )}
          {line}
        </text>
      ))}
    </>
  )
}

// A step the agent marked likely wrong: its stop and name, then why, dimmed under them.
function LikelyWrong({ flag, width }: { flag: FlaggedStep; width: number }) {
  const tones = useTones()
  return (
    <box flexDirection="column">
      <text fg={tones.bad}>
        {`⚠ stop ${String(flag.number)}${SEPARATOR}${flag.name ?? flag.file}`}
      </text>
      {wrap(flag.note, Math.min(width, PROSE_MOST) - 2).map((line, i) => (
        <text key={i} fg={tones.dim}>{`  ${line}`}</text>
      ))}
    </box>
  )
}

/**
 * A change's trek before it's stepped: its title and story, where its scenario starts and how it
 * ends, as predicted, and the steps the agent marked likely wrong, each with why.
 */
export function TrekPreview({ view, width }: { view: OverviewView; width: number }) {
  const tones = useTones()
  const shown = view.likely_wrong.slice(0, FLAGS_SHOWN)
  const more = view.likely_wrong.length - shown.length

  return (
    <box flexDirection="column">
      <text attributes={TextAttributes.BOLD}>{view.title}</text>
      {wrap(view.overview, Math.min(width, PROSE_MOST)).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          {line}
        </text>
      ))}
      <text> </text>
      <End
        glyph="▶"
        label="Trigger"
        text={`${view.trigger.kind}${SEPARATOR}${view.trigger.input}`}
        width={width}
      />
      <End glyph="■" label={LABEL} text={view.outcome} width={width} />
      {shown.map((flag) => (
        <box key={flag.id} flexDirection="column">
          <text> </text>
          <LikelyWrong flag={flag} width={width} />
        </box>
      ))}
      {more > 0 && <text fg={tones.bad}>{`⚠ ${String(more)} more likely wrong`}</text>}
    </box>
  )
}
