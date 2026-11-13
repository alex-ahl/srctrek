import type { EndView, FlaggedStep, OverviewView } from "@srctrek/core"
import { escapeHtml, gotoLink, pageHtml } from "./page"

// The trek tab's page for the overview and the end, apart from VS Code: plain HTML in the theme's
// colours, where a flag at the end is a link to its stop.

export type TrekPageView = OverviewView | EndView

const FLAGS = {
  high: { mark: "⚠", wording: "likely wrong" },
  medium: { mark: "●", wording: "risky" },
  low: { mark: "●", wording: "worth knowing" },
} as const

// The keys srctrek binds by default; VS Code doesn't tell an extension what they're rebound to,
// so the page names the commands beside them.
const KEYS = [
  ["F8", "next stop"],
  ["Shift+F8", "previous stop"],
  ["F11", "into the call on the cursor's line"],
  ["F10", "over the step's calls"],
  ["Shift+F11", "out of the function"],
] as const

// What the trek draws in the code, each beside a sample of how it looks, said once here rather
// than on every line.
const ON_SCREEN = [
  [`<span class="bar added"></span>`, "a line this change added"],
  [`<span class="bar changed"></span>`, "a line this change edited"],
  [
    `<code class="value">name ≈ 40</code>`,
    "a predicted value, worked out from the code, not run; ≈? when unsure",
  ],
  [`<code class="arrow">→</code>`, "a call next can step into; →? when the link is guessed"],
  [
    `<code class="lens">srctrek 2/5 · next ▸</code>`,
    "above a stop: click to open the Stop view, or to step on",
  ],
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
  const onScreen = ON_SCREEN.map(
    ([sample, means]) => `<tr><th>${sample}</th><td>${means}</td></tr>`,
  )
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
    `<p class="muted">the default keys; rebound ones show in Keyboard Shortcuts under srctrek</p>`,
    "<h2>On screen</h2>",
    `<table>${onScreen.join("")}</table>`,
    `<p class="muted">${String(view.count)} stops · srctrek: Next Stop (F8 by default) to start</p>`,
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
    "<h2>End of the trek</h2>",
    `<p class="story">${escapeHtml(view.outcome)}</p>`,
    flags,
    `<p class="muted">a flag goes to its stop · srctrek: Previous Stop (Shift+F8 by default) back to the last stop</p>`,
  ].join("\n")
}

const STYLE = `
  body { background: var(--vscode-editor-background); max-width: 46em; padding: 1.5em 2em; }
  .story { font-size: 1.1em; }
  .muted { margin-top: 1.6em; }
  ul.flags { list-style: none; padding: 0; }
  ul.flags li { margin-bottom: 0.8em; }
  .bar { display: inline-block; width: 3px; height: 1.1em; margin-right: 4px; vertical-align: middle; }
  .bar.added { background: var(--vscode-editorGutter-addedBackground); }
  .bar.changed { background: var(--vscode-editorGutter-modifiedBackground); }
  .value { color: var(--vscode-editorInlayHint-foreground); }
  .arrow { color: var(--vscode-textLink-foreground); }
  .lens { color: var(--vscode-editorCodeLens-foreground); }
`

/** The whole page; `nonce` lets only its own script run. */
export function trekPageHtml(view: TrekPageView, nonce: string): string {
  const body = view.kind === "overview" ? overviewBody(view) : endBody(view)
  return pageHtml(body, nonce, STYLE)
}
