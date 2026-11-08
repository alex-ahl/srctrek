import { strict as assert } from "node:assert"
import * as vscode from "vscode"

/** Points the extension at the trek serve the runner names, from this checkout. */
export async function useTestServe(): Promise<void> {
  const command = process.env["SRCTREK_SERVE"]
  assert.ok(command, "SRCTREK_SERVE names the trek serve to use")
  await vscode.workspace
    .getConfiguration("srctrek")
    .update("serveCommand", JSON.parse(command), vscode.ConfigurationTarget.Global)
}
