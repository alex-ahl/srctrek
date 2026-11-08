import type { StepView } from "@codetrail/core"
import * as vscode from "vscode"
import { changedLinesShown } from "./view"

export type ChangeMarks = {
  show: (editor: vscode.TextEditor, view: StepView, newFile: boolean) => void
  types: vscode.TextEditorDecorationType[]
}

// A bar at the code's left edge in the theme's diff colours, and a mark on the scrollbar: an
// extension's gutter icon can't take a theme colour, a border can.
function barOf(colour: string): vscode.TextEditorDecorationType {
  const themed = new vscode.ThemeColor(colour)
  return vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderColor: themed,
    borderStyle: "solid",
    borderWidth: "0 0 0 3px",
    overviewRulerColor: themed,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  })
}

/** The lines the change adds or edits in the stop's file; a file it adds whole gets none. */
export function createChangeMarks(): ChangeMarks {
  const added = barOf("editorGutter.addedBackground")
  const changed = barOf("editorGutter.modifiedBackground")

  const show = (editor: vscode.TextEditor, view: StepView, newFile: boolean): void => {
    const lines = changedLinesShown(view, newFile, editor.document.lineCount)
    const ranges = (change: "added" | "changed") =>
      lines
        .filter((line) => line.change === change)
        .map((line) => new vscode.Range(line.line - 1, 0, line.line - 1, 0))
    editor.setDecorations(added, ranges("added"))
    editor.setDecorations(changed, ranges("changed"))
  }

  return { show, types: [added, changed] }
}
