import { type RGBA, TextAttributes } from "@opentui/core"
import type { SettingRow } from "./settings-rows"
import { fit } from "./text"
import { COLOUR, type Tone, useTones } from "./theme"

const NAME_WIDTH = 24
const GAP = "  "

// The states as the home screen shows them, in the colours chosen, so the choice shows itself.
const SAMPLE: ReadonlyArray<Readonly<{ text: string; tone: Tone }>> = [
  { text: "● ready", tone: "good" },
  { text: "≠ stale", tone: "warn" },
  { text: "✕ can't open", tone: "bad" },
]
const SAMPLE_WIDTH = SAMPLE.reduce((width, state) => width + GAP.length + state.text.length, 1)

// What follows the value: its mark, its note, the sample; the value is cut to leave room for them.
function extrasWidth(row: SettingRow): number {
  const mark = row.mark === undefined ? 0 : GAP.length + row.mark.symbol.length
  const note = row.note === undefined ? 0 : GAP.length + row.note.length
  const sample = row.sample === undefined ? 0 : SAMPLE_WIDTH

  return mark + note + sample
}

function Sample() {
  const tones = useTones()

  return (
    <span>
      {" "}
      {SAMPLE.map((state) => (
        <span key={state.text} fg={tones[state.tone]}>{`${GAP}${state.text}`}</span>
      ))}
    </span>
  )
}

function RowView({
  row,
  selected,
  lineWidth,
  tint,
}: {
  row: SettingRow
  selected: boolean
  lineWidth: number
  tint: RGBA | undefined
}) {
  const tones = useTones()
  const value = fit(row.value, lineWidth - 2 - NAME_WIDTH - extrasWidth(row))
  const marked = selected && tint === undefined

  const line = (
    <text fg={COLOUR.text}>
      <span fg={tones.accent}>{marked ? "▶ " : "  "}</span>
      <span>{row.name.padEnd(NAME_WIDTH)}</span>
      {row.tone === undefined ? (
        <span attributes={TextAttributes.BOLD}>{value}</span>
      ) : (
        <span fg={tones[row.tone]}>{value}</span>
      )}
      {row.mark !== undefined && (
        <span fg={tones[row.mark.tone]}>{`${GAP}${row.mark.symbol}`}</span>
      )}
      {row.note !== undefined && <span fg={tones.dim}>{`${GAP}${row.note}`}</span>}
      {row.sample !== undefined && <Sample />}
    </text>
  )

  return selected && tint !== undefined ? <box style={{ backgroundColor: tint }}>{line}</box> : line
}

// The rows of each group under its heading, a blank line between groups.
function grouped(rows: readonly SettingRow[]) {
  return rows.map((row, index) => ({
    row,
    index,
    heading: index === 0 || rows[index - 1]?.group !== row.group ? row.group : undefined,
  }))
}

/**
 * The settings under their headings, the chosen one on the tint (or marked, where the terminal's
 * colours aren't known), each value cut to fit beside what follows it.
 */
export function SettingsList({
  rows,
  chosen,
  lineWidth,
  tint,
}: {
  rows: readonly SettingRow[]
  chosen: number
  lineWidth: number
  tint: RGBA | undefined
}) {
  const tones = useTones()

  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      {grouped(rows).map(({ row, index, heading }) => (
        <box key={row.name} flexDirection="column" style={{ flexShrink: 0 }}>
          {heading !== undefined && index > 0 && <text fg={COLOUR.text}> </text>}
          {heading !== undefined && <text fg={tones.dim}>{heading}</text>}
          <RowView row={row} selected={index === chosen} lineWidth={lineWidth} tint={tint} />
        </box>
      ))}
    </box>
  )
}
