import type { StepRef, StepView } from "@codetrail/core"

// What the narration panel says, apart from VS Code: its header's tags and its body as markdown.

const FLAG_HINTS: Record<string, string> = { medium: "● risky", low: "● worth knowing" }

// Escapes what markdown would read as syntax, and keeps spaces as spaces so the text wraps.
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, "\\$&")
}

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

/** The header beside "codetrail": the stop, then what a reader should know about its code. */
export function panelLabel(view: StepView, newFile: boolean): string {
  const tags = [
    `stop ${String(view.number)} of ${String(view.count)}`,
    codeTag(view, newFile),
    view.came_from?.guessed === true ? "guessed link" : null,
    view.context.length > 0 ? "context available" : null,
    view.tour_copy ? "tour's version" : null,
    view.stale ? "stale: file changed since" : null,
  ]
  return tags.filter((tag) => tag !== null).join(" · ")
}

// A risky or worth-knowing flag, and where next goes: what a reader stepping with next alone
// mustn't miss beyond the narration.
function hints(view: StepView): string[] {
  const flag = view.flag ? FLAG_HINTS[view.flag.severity] : undefined
  const next = view.step_kind === "context" ? undefined : whereNext(view)
  return [flag, next].filter((hint) => hint !== undefined)
}

/** The panel's body: the narration, a high flag under it, then the hints. */
export function panelBody(view: StepView): string {
  const high = view.flag?.severity === "high" ? escapeMarkdown(`⚠ ${view.flag.note}`) : null
  const footer = hints(view).map(escapeMarkdown).join("  ·  ")
  const parts = [escapeMarkdown(view.summary), high, footer === "" ? null : `*${footer}*`]
  return parts.filter((part) => part !== null).join("\n\n")
}

/** Whether the change adds the file whole, so one tag says it rather than every line. */
export function isNewFile(view: StepView, lineCount: number): boolean {
  const added = view.changed_lines.filter((changed) => changed.change === "added")
  return added.length >= lineCount
}
