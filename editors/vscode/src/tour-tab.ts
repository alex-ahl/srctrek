import { randomBytes } from "node:crypto"
import * as vscode from "vscode"
import { isPageMessage } from "./page"
import { type TourPageView, tourPageHtml } from "./tour-page"

export type TourTab = { show: (view: TourPageView) => void; hide: () => void }

/** One tab at a time for the overview and the end; a flag clicked there calls `goTo` with its stop. */
export function createTourTab(goTo: (step: string) => void): TourTab & vscode.Disposable {
  let panel: vscode.WebviewPanel | undefined

  const open = (): vscode.WebviewPanel => {
    const opened = vscode.window.createWebviewPanel(
      "srctrek.tour",
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

  const show = (view: TourPageView): void => {
    panel ??= open()
    panel.title = view.kind === "overview" ? `Tour: ${view.title}` : `End: ${view.title}`
    panel.webview.html = tourPageHtml(view, randomBytes(16).toString("base64"))
    panel.reveal(vscode.ViewColumn.Active)
  }

  const hide = (): void => {
    panel?.dispose()
  }

  return { show, hide, dispose: hide }
}
