import type { StepView } from "@codetrail/core"
import * as vscode from "vscode"
import { narrationLine, placeOf } from "./view"

// A read-only comment thread is the one widget VS Code lets an extension place between lines that
// wraps its text; a CodeLens or a decoration stays on one row.
export type Narration = { show: (uri: vscode.Uri, view: StepView) => void; hide: () => void }

function bodyOf(view: StepView): vscode.Comment {
  return {
    body: new vscode.MarkdownString().appendText(view.summary),
    mode: vscode.CommentMode.Preview,
    author: { name: "codetrail" },
    label: `stop ${String(view.number)} of ${String(view.count)}`,
  }
}

export function createNarration(): Narration & vscode.Disposable {
  const controller = vscode.comments.createCommentController("codetrail", "codetrail")
  let thread: vscode.CommentThread | undefined

  const hide = (): void => {
    thread?.dispose()
    thread = undefined
  }

  const show = (uri: vscode.Uri, view: StepView): void => {
    hide()
    const line = narrationLine(placeOf(view))
    thread = controller.createCommentThread(uri, new vscode.Range(line, 0, line, 0), [bodyOf(view)])
    thread.canReply = false
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded
  }

  return {
    show,
    hide,
    dispose: () => {
      hide()
      controller.dispose()
    },
  }
}
