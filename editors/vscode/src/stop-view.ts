import { randomBytes } from "node:crypto"
import type { StepView } from "@srctrek/core"
import * as vscode from "vscode"
import { isPageMessage } from "./page"
import { type CodeRange, codeRangesOf, stopPageHtml } from "./stop-page"

export type StopView = {
  show: (view: StepView | null) => Promise<void>
  // scrolls the page to one of its blocks, by its id
  reveal: (block: string) => void
}

function rangeKey(range: CodeRange): string {
  return `${range.path}:${String(range.first)}-${String(range.last)}`
}

function linesOf(document: vscode.TextDocument, range: CodeRange): string[] {
  const last = Math.min(range.last, document.lineCount)
  const numbers = Array.from({ length: last - range.first + 1 }, (_, index) => range.first + index)
  return numbers.map((line) => document.lineAt(line - 1).text)
}

// The code the page shows, read before it's drawn, as the page itself reads no files.
async function codeOf(ranges: readonly CodeRange[]): Promise<Map<string, string[]>> {
  const code = new Map<string, string[]>()
  for (const range of ranges) {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(range.path))
      code.set(rangeKey(range), linesOf(document, range))
    } catch {
      // a file gone since the trek was built shows no code; its place still links
    }
  }
  return code
}

async function openAt(path: string, line: number): Promise<void> {
  const at = new vscode.Position(line - 1, 0)
  await vscode.window.showTextDocument(vscode.Uri.file(path), {
    selection: new vscode.Range(at, at),
    preview: true,
  })
}

/** The srctrek sidebar's Stop view; a stop clicked there calls `goTo`, a cited line opens. */
export function createStopView(goTo: (step: string) => void): StopView & vscode.Disposable {
  let webview: vscode.WebviewView | undefined
  let current: StepView | null = null
  let code = new Map<string, string[]>()

  const render = (): void => {
    if (webview === undefined) {
      return
    }
    const codeAt = (range: CodeRange): readonly string[] => code.get(rangeKey(range)) ?? []
    webview.webview.html = stopPageHtml(current, codeAt, randomBytes(16).toString("base64"))
  }

  const onMessage = (message: unknown): void => {
    if (!isPageMessage(message)) {
      return
    }
    if ("goto" in message) {
      goTo(message.goto)
      return
    }
    void openAt(message.open, message.line)
  }

  const registration = vscode.window.registerWebviewViewProvider("srctrek.stop", {
    resolveWebviewView: (view) => {
      webview = view
      view.webview.options = { enableScripts: true, localResourceRoots: [] }
      view.webview.onDidReceiveMessage(onMessage)
      view.onDidDispose(() => {
        webview = undefined
      })
      render()
    },
  })

  return {
    show: async (view) => {
      current = view
      code = await codeOf(view === null ? [] : codeRangesOf(view))
      render()
    },
    reveal: (block) => {
      void webview?.webview.postMessage({ scrollTo: block })
    },
    dispose: () => {
      registration.dispose()
    },
  }
}
