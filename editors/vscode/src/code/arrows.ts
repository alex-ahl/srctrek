import type { StepView } from "@srctrek/core"
import * as vscode from "vscode"
import { type CallMark, callMarks } from "./call-marks"

export type Arrows = { show: (editor: vscode.TextEditor, view: StepView) => void }

function decorationOf(document: vscode.TextDocument, mark: CallMark): vscode.DecorationOptions {
  const end = document.lineAt(mark.line).range.end
  return { range: new vscode.Range(end, end), renderOptions: { after: { contentText: mark.text } } }
}

export function createArrows(): Arrows & { types: vscode.TextEditorDecorationType[] } {
  const style = { color: new vscode.ThemeColor("textLink.foreground"), margin: "0 0 0 2ch" }
  const plain = vscode.window.createTextEditorDecorationType({ after: style })
  // the arrow next enters from stands out from the others
  const leadsNext = vscode.window.createTextEditorDecorationType({
    after: { ...style, fontWeight: "bold" },
  })

  const show = (editor: vscode.TextEditor, view: StepView): void => {
    const marks = callMarks(view).filter((mark) => mark.line < editor.document.lineCount)
    const decorations = (wanted: boolean) =>
      marks
        .filter((mark) => mark.leadsNext === wanted)
        .map((mark) => decorationOf(editor.document, mark))
    editor.setDecorations(plain, decorations(false))
    editor.setDecorations(leadsNext, decorations(true))
  }

  return { show, types: [plain, leadsNext] }
}
