// Runs inside VS Code, loaded by run-in-vscode.ts: drives the extension's commands on the
// two-call pay tour and checks what the editor shows. VS Code reports a thrown error as a failed run.
import { strict as assert } from "node:assert"
import { basename } from "node:path"
import * as vscode from "vscode"
import { useTestServe } from "./serve"

type Check = { name: string; run: () => Promise<void> }

function editorAt(): { file: string; line: number } {
  const editor = vscode.window.activeTextEditor
  assert.ok(editor, "an editor is open")
  return { file: basename(editor.document.uri.fsPath), line: editor.selection.active.line + 1 }
}

// VS Code draws the narration panel after the command that asked for it returns, and moves the
// cursor back to the step as it does; a reader's next key comes long after.
const SETTLE_MS = 300

async function putCursorOn(line: number): Promise<void> {
  await new Promise((settled) => setTimeout(settled, SETTLE_MS))
  const editor = vscode.window.activeTextEditor
  assert.ok(editor, "an editor is open")
  editor.selection = new vscode.Selection(line - 1, 0, line - 1, 0)
}

const checks: Check[] = [
  {
    name: "opens a tour by name at its overview",
    run: async () => {
      await vscode.commands.executeCommand("codetrail.openTour", "pay")
      assert.equal(vscode.window.activeTextEditor, undefined)
    },
  },
  {
    name: "next opens the first stop's file at its first line",
    run: async () => {
      await vscode.commands.executeCommand("codetrail.next")
      assert.deepEqual(editorAt(), { file: "main.ts", line: 1 })
    },
  },
  {
    name: "next follows the call into pay",
    run: async () => {
      await vscode.commands.executeCommand("codetrail.next")
      assert.deepEqual(editorAt(), { file: "pay.ts", line: 1 })
    },
  },
  {
    name: "previous goes back to main",
    run: async () => {
      await vscode.commands.executeCommand("codetrail.previous")
      assert.deepEqual(editorAt(), { file: "main.ts", line: 1 })
    },
  },
  {
    name: "into steps into the call on the cursor's line",
    run: async () => {
      await putCursorOn(2)
      await vscode.commands.executeCommand("codetrail.into")
      assert.deepEqual(editorAt(), { file: "send.ts", line: 1 })
    },
  },
  {
    name: "show current stop brings the cursor back to the stop",
    run: async () => {
      await putCursorOn(3)
      await vscode.commands.executeCommand("codetrail.current")
      assert.deepEqual(editorAt(), { file: "send.ts", line: 1 })
    },
  },
  {
    name: "into with nothing to step into leaves the cursor where it is",
    run: async () => {
      await putCursorOn(2)
      await vscode.commands.executeCommand("codetrail.into")
      assert.deepEqual(editorAt(), { file: "send.ts", line: 2 })
    },
  },
]

export async function run(): Promise<void> {
  await useTestServe()
  const failed: string[] = []
  for (const check of checks) {
    try {
      await check.run()
      console.log(`ok    ${check.name}`)
    } catch (error) {
      failed.push(check.name)
      console.log(`FAIL  ${check.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  await vscode.commands.executeCommand("codetrail.quit")
  if (failed.length > 0) {
    throw new Error(`${String(failed.length)} of ${String(checks.length)} checks failed`)
  }
}
