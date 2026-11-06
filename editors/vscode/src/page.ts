// What the extension's webview pages share: escaping, the theme's look, and the one script, which
// posts a clicked link back to the extension.

/** A clicked link: the stop to go to, or a file to open at a line. */
export type PageMessage = { goto: string } | { open: string; line: number }

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function gotoLink(id: string, text: string): string {
  return `<a href="#" data-goto="${escapeHtml(id)}">${text}</a>`
}

export function openLink(path: string, line: number, text: string): string {
  return `<a href="#" data-open="${escapeHtml(path)}" data-line="${String(line)}">${text}</a>`
}

export function isPageMessage(message: unknown): message is PageMessage {
  if (typeof message !== "object" || message === null) {
    return false
  }
  if ("goto" in message) {
    return typeof message.goto === "string"
  }
  return "open" in message && typeof message.open === "string" && "line" in message
}

const STYLE = `
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
    line-height: 1.5; }
  h1 { font-size: 1.6em; margin-bottom: 0.4em; }
  h2 { font-size: 1.1em; margin-top: 1.6em; }
  table { border-collapse: collapse; }
  th { text-align: left; font-weight: normal; color: var(--vscode-descriptionForeground);
    padding: 0.15em 1.5em 0.15em 0; vertical-align: top; white-space: nowrap; }
  a { color: var(--vscode-textLink-foreground); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: var(--vscode-descriptionForeground); }
  .high, .high a { color: var(--vscode-editorError-foreground); }
  .medium, .medium a { color: var(--vscode-editorWarning-foreground); }
  .low, .low a { color: var(--vscode-editorInfo-foreground); }
  .guessed { color: var(--vscode-editorHint-foreground); }
  code, kbd { font-family: var(--vscode-editor-font-family); }
`

const SCRIPT = `
  const vscode = acquireVsCodeApi()
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-goto], [data-open]")
    if (!link) return
    event.preventDefault()
    if (link.dataset.goto) {
      vscode.postMessage({ goto: link.dataset.goto })
    } else {
      vscode.postMessage({ open: link.dataset.open, line: Number(link.dataset.line) })
    }
  })
`

/** A whole page around `body`; `nonce` lets only the page's own script run. */
export function pageHtml(body: string, nonce: string, style = ""): string {
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'`
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>${STYLE}${style}</style></head>
<body>
${body}
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`
}
