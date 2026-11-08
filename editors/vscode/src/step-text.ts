import type { StepRef, StepView } from "@codetrail/core"

// What a stop says besides its narration, apart from VS Code: where next goes, its tags, and the
// actions on the line above it.

export const FLAG_WORDING = {
  high: "⚠ likely wrong",
  medium: "● risky",
  low: "● worth knowing",
} as const

function labelOf(ref: StepRef | null): string {
  if (ref === null) {
    return "the end of the tour"
  }
  return ref.name ?? `${ref.file}:${String(ref.start_line)}`
}

/** Where next goes from here, in words, so the reader knows before pressing it. */
export function whereNext(view: StepView): string {
  const { how, to, line } = view.next
  if (how === "end") {
    return "next: the end of the tour"
  }
  if (how === "into") {
    return `next: into ${labelOf(to)}${line === null ? "" : `, line ${String(line)}`}`
  }
  if (how === "hop") {
    // a hop names its repo only when it leaves this one
    const repo = to !== null && to.repo !== view.repo ? `${to.repo}: ` : ""
    return `next: ↯ ${repo}${labelOf(to)}`
  }
  if (how === "back") {
    return `next: back to ${labelOf(to)}`
  }
  return `next: ${labelOf(to)}`
}

// What kind of code the step is: code the change adds whole, or existing code the flow passes
// through; code the change edits needs no word.
function codeTag(view: StepView, newFile: boolean): string | null {
  if (newFile) {
    return "new file"
  }
  return view.changed ? null : "existing code"
}

/** What a reader should know about the stop's code, for the status bar beside its number. */
export function stepTags(view: StepView, newFile: boolean): string[] {
  const tags = [
    codeTag(view, newFile),
    view.came_from?.guessed === true ? "guessed link" : null,
    view.context.length > 0 ? "context available" : null,
    view.tour_copy ? "tour's version" : null,
    view.stale ? "stale: file changed since" : null,
  ]
  return tags.filter((tag) => tag !== null)
}

/** An action on the line above the stop: its text, and the command a click runs. */
export type Lens = { title: string; command: string }

/** The stop's number and flag, which open the Stop view, its context, and where next goes. */
export function stepLenses(view: StepView): Lens[] {
  const lenses = [
    {
      title: `codetrail ${String(view.number)}/${String(view.count)}`,
      command: "codetrail.stop.focus",
    },
    view.flag ? { title: FLAG_WORDING[view.flag.severity], command: "codetrail.stop.focus" } : null,
    view.context.length > 0 ? { title: "context", command: "codetrail.context" } : null,
    view.step_kind === "context"
      ? null
      : { title: `${whereNext(view)} ▸`, command: "codetrail.next" },
  ]
  return lenses.filter((lens) => lens !== null)
}

/** Whether the change adds the file whole, so one tag says it rather than every line. */
export function isNewFile(view: StepView, lineCount: number): boolean {
  const added = view.changed_lines.filter((changed) => changed.change === "added")
  return added.length >= lineCount
}
