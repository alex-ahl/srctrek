import type { EndView, FlaggedStep, OverviewView } from "@codetrail/core"
import { escapeHtml, gotoLink, pageHtml } from "./page"

// The tour tab's page for the overview and the end, apart from VS Code: plain HTML in the theme's
// colours, where a flag at the end is a link to its stop.

export type TourPageView = OverviewView | EndView

const FLAGS = {
  high: { mark: "⚠", wording: "likely wrong" },
  medium: { mark: "●", wording: "risky" },
  low: { mark: "●", wording: "worth knowing" },
} as const

const KEYS = [
  ["F8", "next stop"],
  ["Shift+F8", "previous stop"],
  ["F11", "into the call on the cursor's line"],
  ["F10", "over the step's calls"],
  ["Shift+F11", "out of the function"],
] as const

// The file's last two parts and its line, as the narration and Neovim write a place.
function placeText(ref: FlaggedStep): string {
  const short = ref.file.split("/").slice(-2).join("/")
  const name = ref.name === null ? "" : ` · ${ref.name}`
  return `${short}:${String(ref.start_line)}${name}`
}

function row(label: string, value: string): string {
  return `<tr><th>${label}</th><td>${escapeHtml(value)}</td></tr>`
}

function flagCounts(flags: OverviewView["flags"]): string {
  const severities = ["high", "medium", "low"] as const
  const counted = severities
    .filter((severity) => flags[severity] > 0)
    .map((severity) => `${String(flags[severity])} ${FLAGS[severity].wording}`)
  return counted.length > 0 ? counted.join(" · ") : "none"
}

function overviewBody(view: OverviewView): string {
  const keys = KEYS.map(([key, does]) => `<tr><th><kbd>${key}</kbd></th><td>${does}</td></tr>`)
  return [
    `<h1>${escapeHtml(view.title)}</h1>`,
    `<p class="story">${escapeHtml(view.overview)}</p>`,
    "<table>",
    row("Trigger", `${view.trigger.kind} · ${view.trigger.input}`),
    row("Outcome", view.outcome),
    row("Repos", view.repos.join(", ")),
    row("Flags", flagCounts(view.flags)),
    "</table>",
    "<h2>Keys</h2>",
    `<table>${keys.join("")}</table>`,
    `<p class="muted">${String(view.count)} stops · F8 to start</p>`,
  ].join("\n")
}

function flagItem(flag: FlaggedStep): string {
  const style = FLAGS[flag.severity]
  return [
    `<li class="${flag.severity}">`,
    gotoLink(
      flag.id,
      `${style.mark} ${style.wording} · ${String(flag.number)} · ${escapeHtml(placeText(flag))}`,
    ),
    `<div>${escapeHtml(flag.note)}</div>`,
    "</li>",
  ].join("")
}

function endBody(view: EndView): string {
  const flags =
    view.flags.length === 0
      ? `<p class="muted">No flags.</p>`
      : `<h2>Flags</h2><ul class="flags">${view.flags.map(flagItem).join("\n")}</ul>`
  return [
    `<h1>${escapeHtml(view.title)}</h1>`,
    "<h2>End of the tour</h2>",
    `<p class="story">${escapeHtml(view.outcome)}</p>`,
    flags,
    `<p class="muted">a flag goes to its stop · Shift+F8 back to the last stop</p>`,
  ].join("\n")
}

const STYLE = `
  body { background: var(--vscode-editor-background); max-width: 46em; padding: 1.5em 2em; }
  .story { font-size: 1.1em; }
  .muted { margin-top: 1.6em; }
  ul.flags { list-style: none; padding: 0; }
  ul.flags li { margin-bottom: 0.8em; }
`

/** The whole page; `nonce` lets only its own script run. */
export function tourPageHtml(view: TourPageView, nonce: string): string {
  const body = view.kind === "overview" ? overviewBody(view) : endBody(view)
  return pageHtml(body, nonce, STYLE)
}
