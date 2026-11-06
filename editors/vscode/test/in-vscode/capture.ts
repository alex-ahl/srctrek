// Runs inside VS Code, loaded by capture-vscode.ts: opens the tour CODETRAIL_TOUR names and
// captures the screen into CODETRAIL_SCREENS at the overview, each stop, and the end.
import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import { join } from "node:path"
import { promisify } from "node:util"
import type { SessionView } from "@codetrail/core"
import * as vscode from "vscode"
import { useTestServe } from "./serve"

const execute = promisify(execFile)
// the narration panel and the decorations draw after the command returns
const SETTLE_MS = 800
// a tour with more stops than this is a loop that never reaches its end
const MOST_STOPS = 200

function nameOf(view: SessionView): string {
  return view.kind === "step" ? `stop-${String(view.number).padStart(2, "0")}` : view.kind
}

async function capture(dir: string, index: number, view: SessionView): Promise<void> {
  await new Promise((settled) => setTimeout(settled, SETTLE_MS))
  const file = join(dir, `${String(index).padStart(3, "0")}-${nameOf(view)}.png`)
  await execute("screencapture", ["-x", "-m", file])
  console.log(`captured ${file}`)
}

async function step(command: string, argument?: string): Promise<SessionView> {
  const view = await vscode.commands.executeCommand<SessionView | undefined>(command, argument)
  assert.ok(view, `${command} showed nothing`)
  return view
}

export async function run(): Promise<void> {
  const tour = process.env["CODETRAIL_TOUR"]
  const dir = process.env["CODETRAIL_SCREENS"]
  assert.ok(tour && dir, "CODETRAIL_TOUR and CODETRAIL_SCREENS name the tour and where to save")
  await useTestServe()
  // VS Code's own notice that the user's extensions are off for this run
  await vscode.commands.executeCommand("notifications.clearAll")

  let view = await step("codetrail.openTour", tour)
  await capture(dir, 0, view)
  for (let index = 1; view.kind !== "end" && index <= MOST_STOPS; index++) {
    view = await step("codetrail.next")
    await capture(dir, index, view)
  }

  await vscode.commands.executeCommand("codetrail.quit")
}
