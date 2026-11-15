import type { StepView } from "@srctrek/core"

/** The changed lines to mark in the stop's file: none in a file the change adds whole. */
export function changedLinesShown(
  view: StepView,
  newFile: boolean,
  lineCount: number,
): StepView["changed_lines"] {
  return newFile ? [] : view.changed_lines.filter((changed) => changed.line <= lineCount)
}
