import { strict as assert } from "node:assert"
import * as vscode from "vscode"

/** Points the extension at the trail serve the runner names, from this checkout. */
export async function useTestServe(): Promise<void> {
  const command = process.env["CODETRAIL_SERVE"]
  assert.ok(command, "CODETRAIL_SERVE names the trail serve to use")
  await vscode.workspace
    .getConfiguration("codetrail")
    .update("serveCommand", JSON.parse(command), vscode.ConfigurationTarget.Global)
}
