import type { EndView, FlaggedStep, OverviewView } from "@codetrail/core"

// The tour tab's page for the overview and the end, apart from VS Code: plain HTML in the theme's
// colours, where a flag at the end is a link to its stop.

export type TourPageView = OverviewView | EndView

/** What the page's script posts when a flag is clicked: the stop to go to. */
export type PageMessage = { goto: string }

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

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

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
    `<a href="#" data-goto="${escapeHtml(flag.id)}">`,
    `${style.mark} ${style.wording} · ${String(flag.number)} · ${escapeHtml(placeText(flag))}</a>`,
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
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
    background: var(--vscode-editor-background); max-width: 46em; padding: 1.5em 2em; line-height: 1.5; }
  h1 { font-size: 1.6em; margin-bottom: 0.4em; }
  h2 { font-size: 1.1em; margin-top: 1.6em; }
  .story { font-size: 1.1em; }
  table { border-collapse: collapse; }
  th { text-align: left; font-weight: normal; color: var(--vscode-descriptionForeground);
    padding: 0.15em 1.5em 0.15em 0; vertical-align: top; white-space: nowrap; }
  .muted { color: var(--vscode-descriptionForeground); margin-top: 1.6em; }
  ul.flags { list-style: none; padding: 0; }
  ul.flags li { margin-bottom: 0.8em; }
  ul.flags a { text-decoration: none; }
  ul.flags a:hover { text-decoration: underline; }
  li.high a { color: var(--vscode-editorError-foreground); }
  li.medium a { color: var(--vscode-editorWarning-foreground); }
  li.low a { color: var(--vscode-editorInfo-foreground); }
  kbd { font-family: var(--vscode-editor-font-family); }
`

// Posts the clicked flag's stop to the extension; nothing else on the page runs.
const SCRIPT = `
  const vscode = acquireVsCodeApi()
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-goto]")
    if (link) {
      event.preventDefault()
      vscode.postMessage({ goto: link.dataset.goto })
    }
  })
`

/** The whole page; `nonce` lets only its own script run. */
export function tourPageHtml(view: TourPageView, nonce: string): string {
  const body = view.kind === "overview" ? overviewBody(view) : endBody(view)
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'`
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>${STYLE}</style></head>
<body>
${body}
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`
}
