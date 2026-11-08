import type { Call, SessionView, StepView, TrekEntry } from "@srctrek/core"
import type { Move } from "./client"

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

/** The status bar's text for wherever the trek is; at a stop, its tags follow its number. */
export function statusText(view: SessionView, tags: readonly string[] = []): string {
  if (view.kind === "overview") {
    return `srctrek · ${view.title}`
  }
  if (view.kind === "end") {
    return `srctrek · end of the trek`
  }
  return [`srctrek ${String(view.number)}/${String(view.count)}`, ...tags].join(" · ")
}

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

/** Whether a move left the trek where it was, which the server answers with the same view. */
export function sameView(before: SessionView, after: SessionView): boolean {
  if (before.kind === "step" && after.kind === "step") {
    return before.id === after.id
  }
  return before.kind === after.kind
}

export const NOWHERE: Record<Move, string> = {
  next: "the trek ends here",
  prev: "this is the start of the trek",
  into: "nothing to step into here",
  over: "nothing to step over here",
  out: "nothing to step out to",
  goto: "already there",
}

/** A valid trek's size and its likely-wrong flags, for the lists of treks. */
export function trekSummary(entry: Extract<TrekEntry, { valid: true }>): string {
  const flags = entry.highFlags > 0 ? ` · ${String(entry.highFlags)} likely wrong` : ""
  return `${String(entry.steps)} stops${flags}`
}

/** The changed lines to mark in the stop's file: none in a file the change adds whole. */
export function changedLinesShown(
  view: StepView,
  newFile: boolean,
  lineCount: number,
): StepView["changed_lines"] {
  return newFile ? [] : view.changed_lines.filter((changed) => changed.line <= lineCount)
}
