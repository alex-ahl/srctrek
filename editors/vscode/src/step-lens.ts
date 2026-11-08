import type { StepView } from "@codetrail/core"
import * as vscode from "vscode"
import { stepLenses } from "./step-text"
import { placeOf } from "./view"

export type StepLens = { show: (view: StepView | null) => void }

/** The row of actions VS Code draws above the stop's first line, in the stop's file only. */
export function createStepLens(): StepLens & vscode.Disposable {
  const changed = new vscode.EventEmitter<void>()
  let current: StepView | null = null

  const provideCodeLenses = (document: vscode.TextDocument): vscode.CodeLens[] => {
    if (current === null || document.uri.fsPath !== current.path) {
      return []
    }
    const line = placeOf(current).first
    const range = new vscode.Range(line, 0, line, 0)
    return stepLenses(current).map(
      (lens) => new vscode.CodeLens(range, { title: lens.title, command: lens.command }),
    )
  }
  const registration = vscode.languages.registerCodeLensProvider(
    { scheme: "file" },
    { onDidChangeCodeLenses: changed.event, provideCodeLenses },
  )

  return {
    show: (view) => {
      current = view
      changed.fire()
    },
    dispose: () => {
      registration.dispose()
      changed.dispose()
    },
  }
}
