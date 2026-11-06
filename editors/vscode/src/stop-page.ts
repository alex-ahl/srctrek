import type { CameFrom, Cite, Frame, StepRef, StepView } from "@codetrail/core"
import { escapeHtml, gotoLink, openLink, pageHtml } from "./page"
import { valueText } from "./value-marks"

// The sidebar's page for the stop the tour is on, apart from VS Code: the call stack, where it
// came from with its evidence, its flag, values, context steps, details, and questions.

/** The code on a cited line, read by the caller, so the evidence reads without opening it. */
export type CodeAt = (cite: Cite) => string

const FLAG_WORDING = { high: "⚠ likely wrong", medium: "● risky", low: "● worth knowing" } as const

function placeText(ref: StepRef): string {
  const short = ref.file.split("/").slice(-2).join("/")
  return `${short}:${String(ref.start_line)}`
}

function refText(ref: StepRef): string {
  return escapeHtml(ref.name === null ? placeText(ref) : `${ref.name} · ${placeText(ref)}`)
}

// Newest on top, as a debugger lists frames; the stop's own frame is the top one.
function stackSection(view: StepView): string {
  if (view.stack.length === 0) {
    return ""
  }
  const frame = (ref: Frame, index: number): string => {
    const hop = ref.hop ? `<span class="muted">↯ </span>` : ""
    const text = index === 0 ? `<b>${refText(ref)}</b>` : gotoLink(ref.id, refText(ref))
    return `<li>${hop}${text}</li>`
  }
  const frames = [...view.stack].reverse().map(frame)
  const cause =
    view.started_by === null
      ? ""
      : `<li class="muted">started by ${gotoLink(view.started_by.id, refText(view.started_by))}</li>`
  return `<h2>Call stack</h2><ul class="stack">${frames.join("")}${cause}</ul>`
}

function linkWording(view: StepView, link: CameFrom): string {
  if (link.relation === "for") {
    return "Explains"
  }
  return view.step_kind === "hop" ? "Reached by a hop from" : "Reached from"
}

function citeItem(cite: Cite, codeAt: CodeAt): string {
  const where = escapeHtml(`${cite.repo}: ${cite.file}:${String(cite.line)}`)
  const code = escapeHtml(codeAt(cite))
  return `<li>${openLink(cite.path, cite.line, where)}<pre><code>${code}</code></pre></li>`
}

// Where the stop came from, then each line its evidence cites with that line's code under it.
function cameFromSection(view: StepView, codeAt: CodeAt): string {
  const link = view.came_from
  if (link === null) {
    return ""
  }
  const guessed = link.guessed ? ` <span class="guessed">(guessed: matched by name)</span>` : ""
  const stop = gotoLink(link.id, `stop ${String(link.number)} · ${refText(link)}`)
  const cites = link.cites.map((cite) => citeItem(cite, codeAt)).join("")
  return `<p>${linkWording(view, link)} ${stop}${guessed}</p><ul class="cites">${cites}</ul>`
}

function flagSection(view: StepView): string {
  if (!view.flag) {
    return ""
  }
  const { severity, note } = view.flag
  return `<p class="${severity}">${FLAG_WORDING[severity]} · ${escapeHtml(note)}</p>`
}

function valuesSection(view: StepView): string {
  if (view.predicted_values.length === 0) {
    return ""
  }
  const items = view.predicted_values.map((value) => {
    const text = escapeHtml(valueText(value))
    const wording = value.uncertain === true ? "predicted, unsure" : "predicted"
    return `<li>line ${String(value.line)}: <code>${text}</code> <span class="muted">${wording}</span></li>`
  })
  return `<h2>Values</h2><ul>${items.join("")}</ul>`
}

function contextSection(view: StepView): string {
  if (view.context.length === 0) {
    return ""
  }
  const items = view.context.map(
    (ref) => `<li>${gotoLink(ref.id, refText(ref))}: ${escapeHtml(ref.summary)}</li>`,
  )
  return `<h2>Context</h2><ul>${items.join("")}</ul>`
}

function questionsSection(view: StepView): string {
  if (view.notes.length === 0) {
    return ""
  }
  const items = view.notes.map(
    (note) => `<p><b>Q: ${escapeHtml(note.question)}</b></p><p>${escapeHtml(note.answer)}</p>`,
  )
  return `<h2>Questions</h2>${items.join("")}`
}

const STYLE = `
  body { padding: 0 0.6em; }
  ul { padding-left: 1.2em; }
  ul.stack, ul.cites { list-style: none; padding-left: 0; }
  ul.stack li { padding: 0.1em 0; }
  pre { margin: 0.2em 0 0.6em; white-space: pre-wrap; color: var(--vscode-descriptionForeground); }
  .details { white-space: pre-wrap; }
`

/** The page for a stop, or a line saying how to start when the tour isn't on one. */
export function stopPageHtml(view: StepView | null, codeAt: CodeAt, nonce: string): string {
  if (view === null) {
    return pageHtml(`<p class="muted">No stop open. Run Codetrail: Open Tour…</p>`, nonce, STYLE)
  }
  const body = [
    `<h2>Stop ${String(view.number)} of ${String(view.count)} · ${refText(view)}</h2>`,
    flagSection(view),
    stackSection(view),
    cameFromSection(view, codeAt),
    view.details === "" ? "" : `<h2>Details</h2><p class="details">${escapeHtml(view.details)}</p>`,
    valuesSection(view),
    contextSection(view),
    questionsSection(view),
  ]
  return pageHtml(body.join("\n"), nonce, STYLE)
}
