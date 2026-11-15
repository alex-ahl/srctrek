import type { StepView } from "@srctrek/core"

/** Where a step opens: its file, and its lines numbered from 0, as VS Code counts them. */
export type StepPlace = { path: string; first: number; last: number }

export function placeOf(view: StepView): StepPlace {
  return { path: view.path, first: view.start_line - 1, last: view.end_line - 1 }
}

/**
 * The line above the step, scrolled to so the actions drawn over its first line show; its first
 * on a file's first line.
 */
export function lineAbove(place: StepPlace): number {
  return Math.max(place.first - 1, 0)
}
