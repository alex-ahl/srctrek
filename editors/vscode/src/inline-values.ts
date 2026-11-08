import type { StepView } from "@srctrek/core"
import * as vscode from "vscode"
import { type ValueMark, valueMarks } from "./value-marks"

export type InlineValues = {
  show: (editor: vscode.TextEditor, view: StepView) => void
  toggle: () => boolean
  type: vscode.TextEditorDecorationType
}

const PREDICTED = new vscode.ThemeColor("editorInlayHint.foreground")
const DOUBTFUL = new vscode.ThemeColor("editorWarning.foreground")

// One decoration per value, in the type's order, so a doubtful one takes its own colour.
function decorationOf(document: vscode.TextDocument, mark: ValueMark): vscode.DecorationOptions {
  const end = document.lineAt(mark.line).range.end
  return {
    range: new vscode.Range(end, end),
    renderOptions: {
      after: {
        contentText: mark.text,
        color: mark.doubtful ? DOUBTFUL : PREDICTED,
        margin: mark.first ? "0 0 0 2ch" : "0",
      },
    },
  }
}

export function createInlineValues(): InlineValues {
  const type = vscode.window.createTextEditorDecorationType({})
  let shown = true
  // what's on screen, so a toggle can redraw the values without moving the view
  let current: { editor: vscode.TextEditor; view: StepView } | undefined

  const draw = (): void => {
    if (current === undefined) {
      return
    }
    const { editor, view } = current
    const marks = valueMarks(view).filter((mark) => mark.line < editor.document.lineCount)
    editor.setDecorations(
      type,
      shown ? marks.map((mark) => decorationOf(editor.document, mark)) : [],
    )
  }

  return {
    show: (editor, view) => {
      current = { editor, view }
      draw()
    },
    toggle: () => {
      shown = !shown
      draw()
      return shown
    },
    type,
  }
}
