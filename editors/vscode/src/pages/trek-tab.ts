import { randomBytes } from "node:crypto"
import * as vscode from "vscode"
import { isPageMessage } from "./page"
import { type TrekPageView, trekPageHtml } from "./trek"

export type TrekTab = { show: (view: TrekPageView) => void; hide: () => void }

/** One tab at a time for the overview and the end; a flag clicked there calls `goTo` with its stop. */
export function createTrekTab(goTo: (step: string) => void): TrekTab & vscode.Disposable {
  let panel: vscode.WebviewPanel | undefined

  const open = (): vscode.WebviewPanel => {
    const opened = vscode.window.createWebviewPanel(
      "srctrek.trek",
      "srctrek",
      {
        viewColumn: vscode.ViewColumn.Active,
        preserveFocus: false,
      },
      { enableScripts: true, localResourceRoots: [] },
    )
    opened.webview.onDidReceiveMessage((message: unknown) => {
      if (isPageMessage(message) && "goto" in message) {
        goTo(message.goto)
      }
    })
    opened.onDidDispose(() => {
      panel = undefined
    })
    return opened
  }

  const show = (view: TrekPageView): void => {
    panel ??= open()
    panel.title = view.kind === "overview" ? `Trek: ${view.title}` : `End: ${view.title}`
    panel.webview.html = trekPageHtml(view, randomBytes(16).toString("base64"))
    panel.reveal(vscode.ViewColumn.Active)
  }

  const hide = (): void => {
    panel?.dispose()
  }

  return { show, hide, dispose: hide }
}
