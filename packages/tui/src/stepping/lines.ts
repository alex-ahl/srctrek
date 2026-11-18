import type { StepView } from "@srctrek/core"

/** What a code line shows besides its text: its sign, whether it's in the step, what's at its end. */
export type CodeLine = Readonly<{
  number: number
  text: string
  sign: string
  inStep: boolean
  // the values the trek predicts on this line, and the arrows to the steps it leads to
  values: string
  arrows: string
  // the line next goes into from
  leadsNext: boolean
}>

const CHANGE_SIGNS = { added: "+", changed: "~" } as const

// `name ≈ value`, `returns ≈ value`, "≈?" when the trek doubts it.
function valueText(value: StepView["predicted_values"][number]): string {
  const subject = value.role === "return" ? "returns" : value.name
  return `${subject} ${value.uncertain === true ? "≈?" : "≈"} ${value.value}`
}

function valuesOn(view: StepView, line: number): string {
  return view.predicted_values
    .filter((value) => value.line === line)
    .map(valueText)
    .join("  ")
}

// An arrow for each step the line leads to, a hop's repo named, a guessed link marked.
function arrowsOn(view: StepView, line: number): string {
  return view.calls
    .filter((call) => call.call_line === line)
    .map((call) => `${call.repo === view.repo ? "→" : `↯ ${call.repo}`}${call.guessed ? "?" : ""}`)
    .join(" ")
}

function signOf(view: StepView, line: number): string {
  if (line === view.start_line) {
    return "▶"
  }

  const changed = view.changed_lines.find((each) => each.line === line)
  return changed === undefined ? "" : CHANGE_SIGNS[changed.change]
}

/** The file's lines from `first` to `last`, each with its sign, end, and place in the step. */
export function codeLines(view: StepView, text: string, first: number, last: number): CodeLine[] {
  const all = text.split("\n")
  const leads = view.next.how === "into" || view.next.how === "hop" ? view.next.line : null

  return all.slice(first - 1, last).map((line, i) => {
    const number = first + i
    return {
      number,
      text: line,
      sign: signOf(view, number),
      inStep: number >= view.start_line && number <= view.end_line,
      values: valuesOn(view, number),
      arrows: arrowsOn(view, number),
      leadsNext: number === leads,
    }
  })
}

/**
 * The lines shown in `height` rows: the step near the top, a few lines above it, `band` rows of
 * narration over it, without running past the file's end.
 */
export function windowOf(view: StepView, lineCount: number, height: number, band: number) {
  const room = Math.max(1, height - band)
  const latest = Math.max(1, lineCount - room + 1)
  const first = Math.min(Math.max(1, view.start_line - 3), latest)

  return { first, last: Math.min(lineCount, first + room - 1) }
}
