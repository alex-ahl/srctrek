import type { SessionView, StepView } from "@codetrail/core"

/** Where a step opens: its file, and its lines numbered from 0, as VS Code counts them. */
export type StepPlace = { path: string; first: number; last: number }

export function placeOf(view: StepView): StepPlace {
  return { path: view.path, first: view.start_line - 1, last: view.end_line - 1 }
}

/** The line the narration sits below: the one above the step, or its first on a file's first line. */
export function narrationLine(place: StepPlace): number {
  return Math.max(place.first - 1, 0)
}

/** The status bar's text for wherever the tour is. */
export function statusText(view: SessionView): string {
  if (view.kind === "overview") {
    return `codetrail · ${view.title}`
  }
  if (view.kind === "end") {
    return `codetrail · end of the tour`
  }
  return `codetrail ${view.number}/${view.count}`
}
