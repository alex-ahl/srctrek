import type { CameFrom, Cite, Frame, StepRef, StepView } from "@codetrail/core"
import { escapeHtml, gotoLink, openLink, pageHtml } from "./page"
import { FLAG_WORDING, whereNext } from "./step-text"

// The sidebar's page for the stop the tour is on, apart from VS Code: its narration, details,
// flag, and where next goes, then the call stack, where it came from with its evidence, context
// steps, and questions, each a block of its own. What the status bar, the actions above the step,
// or the code already show (the stop number, the values) isn't repeated.

/** The code on a cited line, read by the caller, so the evidence reads without opening it. */
export type CodeAt = (cite: Cite) => string

function placeText(ref: StepRef): string {
  const short = ref.file.split("/").slice(-2).join("/")
  return `${short}:${String(ref.start_line)}`
}

function refText(ref: StepRef): string {
  return escapeHtml(ref.name === null ? placeText(ref) : `${ref.name} · ${placeText(ref)}`)
}

function section(label: string, content: string): string {
  return `<section><h3>${label}</h3>${content}</section>`
}

// Newest on top, as a debugger lists frames; the stop's own frame is the top one. A stack of the
// stop alone says nothing, so it's left out.
function stackSection(view: StepView): string {
  if (view.stack.length < 2 && view.started_by === null) {
    return ""
  }
  const frame = (ref: Frame, index: number): string => {
    const hop = ref.hop ? `<span class="muted">↯ </span>` : ""
    const text = index === 0 ? refText(ref) : gotoLink(ref.id, refText(ref))
    return `<li>${hop}${text}</li>`
  }
  const frames = [...view.stack].reverse().map(frame)
  const cause =
    view.started_by === null
      ? ""
      : `<li class="muted">started by ${gotoLink(view.started_by.id, refText(view.started_by))}</li>`
  return section("Call stack", `<ul class="rows">${frames.join("")}${cause}</ul>`)
}

function linkWording(view: StepView, link: CameFrom): string {
  if (link.relation === "for") {
    return "Explains"
  }
  return view.step_kind === "hop" ? "By a hop from" : "From"
}

// The cited place, its repo named only when it isn't the stop's, and the line's code beside it.
function citeItem(view: StepView, cite: Cite, codeAt: CodeAt): string {
  const repo = cite.repo === view.repo ? "" : `${cite.repo}: `
  const where = openLink(
    cite.path,
    cite.line,
    escapeHtml(`${repo}${cite.file}:${String(cite.line)}`),
  )
  return `<li>${where} <code>${escapeHtml(codeAt(cite))}</code></li>`
}

function cameFromSection(view: StepView, codeAt: CodeAt): string {
  const link = view.came_from
  if (link === null) {
    return ""
  }
  const guessed = link.guessed ? ` <span class="guessed">guessed: matched by name</span>` : ""
  const stop = gotoLink(link.id, `stop ${String(link.number)} · ${refText(link)}`)
  const cites = link.cites.map((cite) => citeItem(view, cite, codeAt)).join("")
  return section(
    "Came from",
    `<p>${linkWording(view, link)} ${stop}${guessed}</p><ul class="rows">${cites}</ul>`,
  )
}

// The flag and where next goes, on one line under the narration.
function nextLine(view: StepView): string {
  const flag = view.flag
    ? `<span class="${view.flag.severity}">${FLAG_WORDING[view.flag.severity]} · ${escapeHtml(view.flag.note)}</span>`
    : ""
  const next =
    view.step_kind === "context" ? "" : `<span class="muted">${escapeHtml(whereNext(view))}</span>`
  const parts = [flag, next].filter((part) => part !== "")
  return parts.length === 0
    ? ""
    : `<p class="hints">${parts.join('<span class="muted"> · </span>')}</p>`
}

function contextSection(view: StepView): string {
  if (view.context.length === 0) {
    return ""
  }
  const items = view.context.map(
    (ref) =>
      `<li>${gotoLink(ref.id, refText(ref))} <span class="muted">${escapeHtml(ref.summary)}</span></li>`,
  )
  return section("Context", `<ul class="rows">${items.join("")}</ul>`)
}

function questionsSection(view: StepView): string {
  if (view.notes.length === 0) {
    return ""
  }
  const items = view.notes.map(
    (note) =>
      `<p class="question">${escapeHtml(note.question)}</p><p>${escapeHtml(note.answer)}</p>`,
  )
  return section("Questions", items.join(""))
}

function leadSection(view: StepView): string {
  const details = view.details === "" ? "" : `<p class="details">${escapeHtml(view.details)}</p>`
  return `<section class="lead"><p>${escapeHtml(view.summary)}</p>${details}${nextLine(view)}</section>`
}

const STYLE = `
  body { padding: 0 0.8em 1em; font-size: var(--vscode-font-size); line-height: 1.45; }
  p { margin: 0.3em 0; }
  section { padding: 0.6em 0 0.7em; }
  section + section { border-top: 1px solid var(--vscode-sideBarSectionHeader-border,
    var(--vscode-widget-border, rgba(128, 128, 128, 0.25))); }
  h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground); margin: 0 0 0.4em; }
  .details { color: var(--vscode-descriptionForeground); white-space: pre-wrap; }
  .hints { margin-top: 0.5em; }
  ul.rows { list-style: none; margin: 0; padding: 0; }
  ul.rows li { padding: 0.1em 0; }
  code { font-size: var(--vscode-editor-font-size); color: var(--vscode-descriptionForeground); }
  .question { font-weight: 600; }
`

/** The page for a stop, or a line saying how to start when the tour isn't on one. */
export function stopPageHtml(view: StepView | null, codeAt: CodeAt, nonce: string): string {
  if (view === null) {
    return pageHtml(`<p class="muted">No stop open. Run Codetrail: Open Tour…</p>`, nonce, STYLE)
  }
  const body = [
    leadSection(view),
    stackSection(view),
    cameFromSection(view, codeAt),
    contextSection(view),
    questionsSection(view),
  ]
  return pageHtml(body.join("\n"), nonce, STYLE)
}
