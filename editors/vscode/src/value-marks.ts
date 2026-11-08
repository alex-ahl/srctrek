import type { StepView } from "@srctrek/core"

// Predicted values at the end of the lines they belong to, like a debugger's inline values:
// `name ≈ value`, as nothing runs, and `name ≈? value` when the trek doubts it. Long values are
// cut so the line stays readable.

type PredictedValue = StepView["predicted_values"][number]

/** One value's text after its line, numbered from 0; `first` starts its line's run of values. */
export type ValueMark = { line: number; text: string; doubtful: boolean; first: boolean }

const MAX_VALUE = 40

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

function shortened(text: string): string {
  const chars = Array.from(graphemes.segment(text), (part) => part.segment)
  return chars.length <= MAX_VALUE ? text : `${chars.slice(0, MAX_VALUE - 1).join("")}…`
}

// A value as its line shows it: `name ≈ value`, `returns ≈ value`, or `≈?` when doubted.
function valueText(value: PredictedValue): string {
  const sign = value.uncertain === true ? "≈?" : "≈"
  const subject = value.role === "return" ? "returns" : value.name
  return `${subject} ${sign} ${shortened(value.value)}`
}

// Each line's values in the order the trek lists them, the later ones after a comma.
export function valueMarks(view: StepView): ValueMark[] {
  const seen = new Set<number>()
  return view.predicted_values.map((value) => {
    const first = !seen.has(value.line)
    seen.add(value.line)
    return {
      line: value.line - 1,
      text: first ? valueText(value) : `, ${valueText(value)}`,
      doubtful: value.uncertain === true,
      first,
    }
  })
}
