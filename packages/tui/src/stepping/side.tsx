import type { StepView } from "@srctrek/core"
import { fit, wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

// The column's width, beside the code on a terminal wide enough to spare it.
export const SIDE_WIDTH = 34

function Heading({ title }: { title: string }) {
  const tones = useTones()
  return <text fg={tones.dim}>{title}</text>
}

// The call stack newest first, what started it, the step's context, and its flag.
export function Side({ view }: { view: StepView }) {
  const tones = useTones()
  const flag = view.flag ?? undefined
  const frames = view.stack.toReversed()
  const room = SIDE_WIDTH - 2
  const place = (ref: { file: string; start_line: number }) =>
    `${ref.file.split("/").at(-1) ?? ref.file}:${String(ref.start_line)}`

  return (
    <box flexDirection="column" style={{ width: SIDE_WIDTH, paddingLeft: 2, flexShrink: 0 }}>
      <Heading title="CALL STACK" />
      {frames.map((frame, i) => (
        <text key={frame.id} fg={i === 0 ? COLOUR.text : tones.dim}>
          {fit(
            `${frame.hop ? `↯ ${frame.repo}: ` : ""}${frame.name ?? place(frame)}  ${place(frame)}`,
            room,
          )}
        </text>
      ))}
      {view.started_by !== null && (
        <text fg={tones.dim}>
          {fit(`started by ${view.started_by.name ?? place(view.started_by)} ↯`, room)}
        </text>
      )}
      {view.context.length > 0 && (
        <box flexDirection="column" style={{ marginTop: 1 }}>
          <Heading title="CONTEXT" />
          {view.context.map((ref) => (
            <text key={ref.id} fg={tones.accent}>
              {fit(ref.name ?? place(ref), room)}
            </text>
          ))}
        </box>
      )}
      {flag !== undefined && (
        <box flexDirection="column" style={{ marginTop: 1 }}>
          <Heading title="FLAG" />
          {wrap(flag.note, room).map((line, i) => (
            <text key={i} fg={flag.severity === "high" ? tones.bad : tones.warn}>
              {line}
            </text>
          ))}
        </box>
      )}
    </box>
  )
}
