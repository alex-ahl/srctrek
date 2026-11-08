import type { CameFrom, Cite, Frame, StepRef, StepView } from "@codetrail/core"
import { escapeHtml, gotoLink, openLink, pageHtml } from "./page"
import { FLAG_WORDING, whereNext } from "./step-text"

// The sidebar's page for the stop the tour is on, apart from VS Code: its narration, details,
// flag, and where next goes, then the call stack, where it came from with its evidence, context
// steps, and questions, each a block of its own. What the status bar, the actions above the step,
// or the code already show (the stop number, the values) isn't repeated.

/** Lines of a file, numbered from 1, both ends included. */
export type CodeRange = { path: string; first: number; last: number }

/** The code in a range, read by the caller, as the page itself reads no files. */
export type CodeAt = (range: CodeRange) => readonly string[]

// A context piece longer than this shows its start, so a large contract doesn't take over the
// view; the rest is a click away.
const MOST_CONTEXT_LINES = 8

function citeRange(cite: Cite): CodeRange {
  return { path: cite.path, first: cite.line, last: cite.line }
}

function contextRange(ref: StepRef): CodeRange {
  const last = Math.min(ref.end_line, ref.start_line + MOST_CONTEXT_LINES - 1)
  return { path: ref.path, first: ref.start_line, last }
}

/** Every range the page shows code from: each cited line, and each context piece. */
export function codeRangesOf(view: StepView): CodeRange[] {
  const cites = view.came_from?.cites.map(citeRange) ?? []
  return [...cites, ...view.context.map(contextRange)]
}

function placeText(ref: StepRef): string {
  const short = ref.file.split("/").slice(-2).join("/")
  return `${short}:${String(ref.start_line)}`
}

function refText(ref: StepRef): string {
  return escapeHtml(ref.name === null ? placeText(ref) : `${ref.name} · ${placeText(ref)}`)
}

function section(label: string, content: string, id?: string): string {
  const anchor = id === undefined ? "" : ` id="${id}"`
  return `<section${anchor}><h3>${label}</h3>${content}</section>`
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
  const code = codeAt(citeRange(cite))[0]?.trim() ?? ""
  return `<li>${where} <code>${escapeHtml(code)}</code></li>`
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

// The flag, then where next goes, each a line of its own under the narration.
function flagLine(view: StepView): string {
  if (!view.flag) {
    return ""
  }
  const { severity, note } = view.flag
  return `<p class="${severity}">${FLAG_WORDING[severity]} · ${escapeHtml(note)}</p>`
}

function nextLine(view: StepView): string {
  return view.step_kind === "context" ? "" : `<p class="muted">${escapeHtml(whereNext(view))}</p>`
}

// Each piece's reason, then where it is, then its code, as the narration explains a step above
// its code.
function contextPiece(ref: StepRef, codeAt: CodeAt): string {
  const code = codeAt(contextRange(ref)).join("\n")
  const hidden = ref.end_line - contextRange(ref).last
  const more =
    hidden > 0 ? `<p class="more">${gotoLink(ref.id, `… ${String(hidden)} more lines`)}</p>` : ""
  return [
    `<div class="piece">`,
    `<p>${escapeHtml(ref.summary)}</p>`,
    `<p class="place">${gotoLink(ref.id, refText(ref))}</p>`,
    `<pre class="code">${escapeHtml(code)}</pre>`,
    more,
    "</div>",
  ].join("")
}

function contextSection(view: StepView, codeAt: CodeAt): string {
  if (view.context.length === 0) {
    return ""
  }
  const pieces = view.context.map((ref) => contextPiece(ref, codeAt))
  return section("Context", pieces.join(""), "context")
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
  return `<section class="lead"><p>${escapeHtml(view.summary)}</p>${details}${flagLine(view)}${nextLine(view)}</section>`
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
  ul.rows { list-style: none; margin: 0; padding: 0; }
  ul.rows li { padding: 0.1em 0; }
  code { font-size: var(--vscode-editor-font-size); color: var(--vscode-descriptionForeground); }
  .question { font-weight: 600; }
  .piece + .piece { margin-top: 1em; }
  .place, .more { font-size: 11px; }
  pre.code { margin: 0.3em 0 0; padding: 0.5em 0.6em; overflow-x: auto; border-radius: 3px;
    font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size);
    background: var(--vscode-textCodeBlock-background);
    border-left: 2px solid var(--vscode-textLink-foreground); }
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
    contextSection(view, codeAt),
    questionsSection(view),
  ]
  return pageHtml(body.join("\n"), nonce, STYLE)
}
