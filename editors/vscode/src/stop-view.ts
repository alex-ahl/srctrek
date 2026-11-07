import { randomBytes } from "node:crypto"
import type { Cite, StepView } from "@codetrail/core"
import * as vscode from "vscode"
import { isPageMessage } from "./page"
import { stopPageHtml } from "./stop-page"

export type StopView = { show: (view: StepView | null) => Promise<void> }

function citeKey(cite: Cite): string {
  return `${cite.path}:${String(cite.line)}`
}

// Each cited line's code, read before the page is drawn, as the page itself reads no files.
async function codeOfCites(cites: readonly Cite[]): Promise<Map<string, string>> {
  const code = new Map<string, string>()
  for (const cite of cites) {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(cite.path))
      code.set(citeKey(cite), document.lineAt(cite.line - 1).text.trim())
    } catch {
      // a file or line gone since the tour was built shows no code; its place still links
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

/** The codetrail sidebar's Stop view; a stop clicked there calls `goTo`, a cited line opens. */
export function createStopView(goTo: (step: string) => void): StopView & vscode.Disposable {
  let webview: vscode.WebviewView | undefined
  let current: StepView | null = null
  let code = new Map<string, string>()

  const render = (): void => {
    if (webview === undefined) {
      return
    }
    const codeAt = (cite: Cite): string => code.get(citeKey(cite)) ?? ""
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

  const registration = vscode.window.registerWebviewViewProvider("codetrail.stop", {
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
      code = await codeOfCites(view?.came_from?.cites ?? [])
      render()
    },
    dispose: () => {
      registration.dispose()
    },
  }
}
