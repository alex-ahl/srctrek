import { TextAttributes } from "@opentui/core"
import type { EndView, OverviewView } from "@srctrek/core"
import { fit, wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

// "Outcome   …" with the text wrapped under itself, past the label.
function Labelled({ label, text, width }: { label: string; text: string; width: number }) {
  const tones = useTones()
  const indent = 10
  return (
    <>
      {wrap(text, Math.min(width, 100) - indent).map((line, i) => (
        <text key={i} fg={tones.dim}>{`${(i === 0 ? label : "").padEnd(indent)}${line}`}</text>
      ))}
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
        text={`${view.trigger.kind} · ${view.trigger.input}`}
        width={width}
      />
      <Labelled label="Outcome" text={view.outcome} width={width} />
      <Labelled label="Repos" text={view.repos.join(", ")} width={width} />
      <text> </text>
      <text fg={tones.dim}>{`${String(view.count)} stops · n to start`}</text>
    </box>
  )
}

// After the last step: the outcome, then every flag, most severe first.
export function End({ view, width }: { view: EndView; width: number }) {
  const tones = useTones()
  return (
    <box flexDirection="column">
      <text attributes={TextAttributes.BOLD}>End of trek</text>
      {wrap(view.outcome, Math.min(width, 90)).map((line, i) => (
        <text key={i} fg={COLOUR.text}>
          {line}
        </text>
      ))}
      <text> </text>
      {view.flags.length === 0 && <text fg={tones.dim}>No flags.</text>}
      {view.flags.map((flag) => (
        <text key={flag.id} fg={flag.severity === "high" ? tones.bad : tones.warn}>
          {fit(`${String(flag.number)} · ${flag.name ?? flag.file} · ${flag.note}`, width)}
        </text>
      ))}
    </box>
  )
}
