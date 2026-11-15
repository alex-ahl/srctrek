import type { Call, StepView } from "@srctrek/core"

/** An arrow at the end of a line that leads into another step, its line numbered from 0. */
export type CallMark = { line: number; text: string; leadsNext: boolean }

// The line itself says what it calls; only a hop into another repo says where it goes, and a link
// matched only by name gets a ?, since the trek can't prove this line makes the call.
function arrowOf(view: StepView, call: Call): string {
  const arrow = call.repo === view.repo ? "→" : `↯ ${call.repo}`
  return call.guessed ? `${arrow}?` : arrow
}

function nextLine(view: StepView): number | null {
  const { how, line } = view.next
  return how === "into" || how === "hop" ? line : null
}

function arrowsByLine(view: StepView): Map<number, string[]> {
  const byLine = new Map<number, string[]>()
  for (const call of view.calls) {
    if (call.call_line === null) {
      continue
    }
    const arrows = byLine.get(call.call_line) ?? []
    const arrow = arrowOf(view, call)
    byLine.set(call.call_line, arrows.includes(arrow) ? arrows : [...arrows, arrow])
  }
  return byLine
}

export function callMarks(view: StepView): CallMark[] {
  const leadsNext = nextLine(view)
  return [...arrowsByLine(view)].map(([line, arrows]) => ({
    line: line - 1,
    text: arrows.join(" "),
    leadsNext: line === leadsNext,
  }))
}

/** The call made on a line, numbered from 1, of the step's file. */
export function callAt(view: StepView, path: string, line: number): Call | undefined {
  if (path !== view.path) {
    return undefined
  }
  return view.calls.find((call) => call.call_line === line)
}
