import { TextAttributes } from "@opentui/core"
import type { EndView, OverviewView } from "@srctrek/core"
import { fit, wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { MoreLines, Valued, capped, wrapValues } from "../ui/values"
import { Separated } from "../ui/separated"
import { SEPARATOR } from "../ui/separator"

// "Outcome   …" with the text wrapped under itself, past the label, its values in their tone.
function Labelled({ label, text, width }: { label: string; text: string; width: number }) {
  const tones = useTones()
  const indent = 10
  const { shown, more } = capped(wrapValues(text, Math.min(width, 100) - indent))
  return (
    <>
      {shown.map((line, i) => (
        <text key={i} fg={tones.dim}>
          {(i === 0 ? label : "").padEnd(indent)}
          <Valued line={line} />
        </text>
      ))}
      <MoreLines more={more} indent={indent} />
    </>
  )
}

// Before the first step: the trek's story, where it starts and ends, and how to begin.
export function Overview({ view, width }: { view: OverviewView; width: number }) {
  const tones = useTones()
  return (
    <box flexDirection="column">
      <text attributes={TextAttributes.BOLD}>{view.title}</text>
      <text> </text>
      {wrap(view.overview, Math.min(width, 90)).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          {line}
        </text>
      ))}
      <text> </text>
      <Labelled
        label="Trigger"
        text={`${view.trigger.kind}${SEPARATOR}${view.trigger.input}`}
        width={width}
      />
      <Labelled label="Outcome" text={view.outcome} width={width} />
      <Labelled label="Repos" text={view.repos.join(", ")} width={width} />
      <text> </text>
      <text fg={tones.dim}>{`${String(view.count)} stops`}</text>
    </box>
  )
}

// The trek's outcome at its end, a long one cut short.
function Outcome({ text, width }: { text: string; width: number }) {
  const { shown, more } = capped(wrapValues(text, Math.min(width, 90)))
  return (
    <>
      {shown.map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          <Valued line={line} />
        </text>
      ))}
      <MoreLines more={more} indent={0} />
    </>
  )
}

// After the last step: the outcome, then every flag, most severe first.
export function End({ view, width }: { view: EndView; width: number }) {
  const tones = useTones()
  return (
    <box flexDirection="column">
      <text attributes={TextAttributes.BOLD}>End of trek</text>
      <Outcome text={view.outcome} width={width} />
      <text> </text>
      {view.flags.length === 0 && <text fg={tones.dim}>No flags.</text>}
      {view.flags.map((flag) => (
        <text key={flag.id} fg={flag.severity === "high" ? tones.bad : tones.warn}>
          <Separated
            text={fit(
              `${String(flag.number)}${SEPARATOR}${flag.name ?? flag.file}${SEPARATOR}${flag.note}`,
              width,
            )}
          />
        </text>
      ))}
    </box>
  )
}
