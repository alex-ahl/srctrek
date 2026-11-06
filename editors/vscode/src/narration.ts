import type { StepView } from "@codetrail/core"
import * as vscode from "vscode"
import { isNewFile, panelBody, panelLabel } from "./narration-text"
import { narrationLine, placeOf } from "./view"

// A read-only comment thread is the one widget VS Code lets an extension place between lines that
// wraps its text; a CodeLens or a decoration stays on one row.
export type Narration = {
  show: (document: vscode.TextDocument, view: StepView) => void
  hide: () => void
}

// VS Code counts the empty line after a file's last newline; the tour doesn't.
function linesOf(document: vscode.TextDocument): number {
  const last = document.lineAt(document.lineCount - 1)
  return last.isEmptyOrWhitespace ? document.lineCount - 1 : document.lineCount
}

function commentOf(document: vscode.TextDocument, view: StepView): vscode.Comment {
  return {
    body: new vscode.MarkdownString(panelBody(view)),
    mode: vscode.CommentMode.Preview,
    author: { name: "codetrail" },
    label: panelLabel(view, isNewFile(view, linesOf(document))),
  }
}

export function createNarration(): Narration & vscode.Disposable {
  const controller = vscode.comments.createCommentController("codetrail", "codetrail")
  let thread: vscode.CommentThread | undefined

  const hide = (): void => {
    thread?.dispose()
    thread = undefined
  }

  const show = (document: vscode.TextDocument, view: StepView): void => {
    hide()
    const line = narrationLine(placeOf(view))
    const range = new vscode.Range(line, 0, line, 0)
    thread = controller.createCommentThread(document.uri, range, [commentOf(document, view)])
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
