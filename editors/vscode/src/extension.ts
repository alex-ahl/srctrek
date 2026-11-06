import type { SessionView, StepView, TourEntry } from "@codetrail/core"
import * as vscode from "vscode"
import { type Move, TrailClient } from "./client"
import { placeOf, statusText } from "./view"

// The open tour's connection, at the edge as a server's current state is; one tour at a time.
let client: TrailClient | undefined
let stepTint: vscode.TextEditorDecorationType | undefined
let status: vscode.StatusBarItem | undefined

function serveCommand(): string[] {
  return (
    vscode.workspace.getConfiguration("codetrail").get<string[]>("serveCommand") ?? [
      "trail",
      "serve",
    ]
  )
}

function reportFailure(error: unknown): void {
  void vscode.window.showErrorMessage(
    `codetrail: ${error instanceof Error ? error.message : String(error)}`,
  )
}

async function showStep(view: StepView): Promise<void> {
  const place = placeOf(view)
  const editor = await vscode.window.showTextDocument(vscode.Uri.file(place.path), {
    preview: false,
  })
  const range = new vscode.Range(place.first, 0, place.last, 0)
  editor.selection = new vscode.Selection(place.first, 0, place.first, 0)
  editor.revealRange(range, vscode.TextEditorRevealType.AtTop)
  if (stepTint !== undefined) {
    editor.setDecorations(stepTint, [range])
  }
}

async function show(view: SessionView): Promise<void> {
  if (status !== undefined) {
    status.text = statusText(view)
    status.show()
  }
  if (view.kind === "step") {
    await showStep(view)
  } else if (view.kind === "overview") {
    void vscode.window.showInformationMessage(`${view.title}: ${view.overview}`)
  } else {
    void vscode.window.showInformationMessage(`End of the tour: ${view.outcome}`)
  }
}

function pickItem(entry: TourEntry): vscode.QuickPickItem {
  if (!entry.valid) {
    return { label: entry.name, description: entry.problem }
  }
  const flags = entry.highFlags > 0 ? ` · ${String(entry.highFlags)} likely wrong` : ""
  return {
    label: entry.name,
    description: entry.title,
    detail: `${String(entry.steps)} stops${flags}`,
  }
}

function startClient(): TrailClient {
  const folder = vscode.workspace.workspaceFolders?.[0]
  if (folder === undefined) {
    throw new Error("open the folder the tours were built in first")
  }
  return new TrailClient(serveCommand(), folder.uri.fsPath)
}

async function pickTour(running: TrailClient): Promise<string | undefined> {
  const { tours } = await running.tours()
  const picked = await vscode.window.showQuickPick(tours.map(pickItem), {
    placeHolder: "Tour to open",
  })
  return picked?.label
}

// Given a tour's name, as a test or a keybinding can, it opens that one without asking.
async function openTour(name?: unknown): Promise<void> {
  client?.close()
  client = startClient()
  await client.initialize()
  const tour = typeof name === "string" ? name : await pickTour(client)
  if (tour === undefined) {
    return
  }

  await vscode.commands.executeCommand("setContext", "codetrail.open", true)
  await show(await client.open(tour))
}

async function move(to: Move): Promise<void> {
  if (client === undefined) {
    void vscode.window.showWarningMessage("codetrail: no tour is open; run Codetrail: Open Tour…")
    return
  }
  await show(await client.move(to))
}

async function quit(): Promise<void> {
  client?.close()
  client = undefined
  status?.hide()
  for (const editor of vscode.window.visibleTextEditors) {
    if (stepTint !== undefined) {
      editor.setDecorations(stepTint, [])
    }
  }
  await vscode.commands.executeCommand("setContext", "codetrail.open", false)
}

// A command that reports a failure instead of throwing it into VS Code's log.
function command(name: string, run: (argument?: unknown) => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand(name, (argument?: unknown) =>
    run(argument).catch(reportFailure),
  )
}

export function activate(context: vscode.ExtensionContext): void {
  stepTint = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.rangeHighlightBackground"),
    isWholeLine: true,
  })
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
  context.subscriptions.push(
    stepTint,
    status,
    command("codetrail.openTour", openTour),
    command("codetrail.next", () => move("next")),
    command("codetrail.previous", () => move("prev")),
    command("codetrail.quit", quit),
  )
}

export function deactivate(): void {
  client?.close()
}
