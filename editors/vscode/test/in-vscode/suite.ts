// Runs inside VS Code, loaded by run-in-vscode.ts: drives the extension's commands on the pay
// tour and checks what the editor shows. VS Code reports a thrown error as a failed run.
import { strict as assert } from "node:assert"
import { basename } from "node:path"
import * as vscode from "vscode"

type Check = { name: string; run: () => Promise<void> }

function editorAt(): { file: string; line: number } {
  const editor = vscode.window.activeTextEditor
  assert.ok(editor, "an editor is open")
  return { file: basename(editor.document.uri.fsPath), line: editor.selection.active.line + 1 }
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
]

async function useTestServe(): Promise<void> {
  const command = process.env["CODETRAIL_SERVE"]
  assert.ok(command, "CODETRAIL_SERVE names the trail serve to use")
  await vscode.workspace
    .getConfiguration("codetrail")
    .update("serveCommand", JSON.parse(command), vscode.ConfigurationTarget.Global)
}

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
