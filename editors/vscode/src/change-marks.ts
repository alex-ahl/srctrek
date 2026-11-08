import type { StepView } from "@srctrek/core"
import * as vscode from "vscode"
import { changedLinesShown } from "./view"

export type ChangeMarks = {
  show: (editor: vscode.TextEditor, view: StepView, newFile: boolean) => void
  types: vscode.TextEditorDecorationType[]
}

// A bar in the gutter beside the line numbers, where VS Code's own diff bars sit, and a mark on
// the scrollbar. A gutter icon can't take a theme colour, so it comes in light and dark versions
// in VS Code's default diff colours; the scrollbar mark follows the theme.
function barOf(
  media: vscode.Uri,
  icon: "added" | "changed",
  colour: string,
): vscode.TextEditorDecorationType {
  const themed = new vscode.ThemeColor(colour)
  return vscode.window.createTextEditorDecorationType({
    light: { gutterIconPath: vscode.Uri.joinPath(media, `${icon}-light.svg`) },
    dark: { gutterIconPath: vscode.Uri.joinPath(media, `${icon}-dark.svg`) },
    gutterIconSize: "contain",
    overviewRulerColor: themed,
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  })
}

/** The lines the change adds or edits in the stop's file; a file it adds whole gets none. */
export function createChangeMarks(media: vscode.Uri): ChangeMarks {
  const added = barOf(media, "added", "editorGutter.addedBackground")
  const changed = barOf(media, "changed", "editorGutter.modifiedBackground")

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
