import type { SessionView, StepView, TourEntry } from "@codetrail/core"
import * as vscode from "vscode"
import { type Arrows, createArrows } from "./arrows"
import { type Move, TrailClient } from "./client"
import { type InlineValues, createInlineValues } from "./inline-values"
import { type Narration, createNarration } from "./narration"
import { type TourTab, createTourTab } from "./tour-tab"
import { NOWHERE, callAt, narrationLine, placeOf, sameView, statusText } from "./view"

// The open tour's connection and where it is, at the edge as a server's current state is; one
// tour at a time.
let client: TrailClient | undefined
let current: SessionView | undefined
let stepTint: vscode.TextEditorDecorationType | undefined
let arrows: Arrows | undefined
let values: InlineValues | undefined
let decorations: vscode.TextEditorDecorationType[] = []
let status: vscode.StatusBarItem | undefined
let narration: Narration | undefined
let tourTab: TourTab | undefined

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

// The last step's tint and arrows stay in its editor otherwise, when it's still visible.
function clearDecorations(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    for (const type of decorations) {
      editor.setDecorations(type, [])
    }
  }
}

async function showStep(view: StepView): Promise<void> {
  const place = placeOf(view)
  const uri = vscode.Uri.file(place.path)
  const editor = await vscode.window.showTextDocument(uri, { preview: false })
  const range = new vscode.Range(place.first, 0, place.last, 0)
  editor.selection = new vscode.Selection(place.first, 0, place.first, 0)
  clearDecorations()
  if (stepTint !== undefined) {
    editor.setDecorations(stepTint, [range])
  }
  arrows?.show(editor, view)
  values?.show(editor, view)
  if (view.tour_copy) {
    // the tour's version of a file, kept in trail's cache, isn't for editing
    await vscode.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession")
  }

  narration?.show(editor.document, view)
  // from the line the narration hangs below, so it shows above the step rather than off the top
  const shown = new vscode.Range(narrationLine(place), 0, place.last, 0)
  editor.revealRange(shown, vscode.TextEditorRevealType.AtTop)
}

async function show(view: SessionView): Promise<void> {
  current = view
  if (status !== undefined) {
    status.text = statusText(view)
    status.show()
  }
  if (view.kind === "step") {
    tourTab?.hide()
    await showStep(view)
    return
  }

  narration?.hide()
  clearDecorations()
  tourTab?.show(view)
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
async function openTour(name?: unknown): Promise<SessionView | undefined> {
  client?.close()
  client = startClient()
  await client.initialize()
  const tour = typeof name === "string" ? name : await pickTour(client)
  if (tour === undefined) {
    return undefined
  }

  await vscode.commands.executeCommand("setContext", "codetrail.open", true)
  const view = await client.open(tour)
  await show(view)
  return view
}

async function move(to: Move, params?: object): Promise<SessionView | undefined> {
  if (client === undefined) {
    void vscode.window.showWarningMessage("codetrail: no tour is open; run Codetrail: Open Tour…")
    return undefined
  }

  const before = current
  const after = await client.move(to, params)
  // redrawing the same view would snap the cursor back to the step's first line
  if (before !== undefined && sameView(before, after)) {
    vscode.window.setStatusBarMessage(`codetrail: ${NOWHERE[to]}`, 4000)
    return after
  }
  await show(after)
  return after
}

function callAtCursor(): string | undefined {
  const editor = vscode.window.activeTextEditor
  if (current?.kind !== "step" || editor === undefined) {
    return undefined
  }
  const line = editor.selection.active.line + 1
  return callAt(current, editor.document.uri.fsPath, line)?.id
}

// Into the call on the cursor's line; elsewhere the server picks the first not yet visited.
function into(): Promise<SessionView | undefined> {
  const target = callAtCursor()
  return move("into", target === undefined ? undefined : { target })
}

function toggleValues(): Promise<void> {
  const shown = values?.toggle() ?? false
  vscode.window.setStatusBarMessage(`codetrail: values ${shown ? "shown" : "hidden"}`, 3000)
  return Promise.resolve()
}

async function quit(): Promise<void> {
  client?.close()
  client = undefined
  current = undefined
  status?.hide()
  narration?.hide()
  tourTab?.hide()
  clearDecorations()
  await vscode.commands.executeCommand("setContext", "codetrail.open", false)
}

// A command that reports a failure instead of throwing it into VS Code's log. A move or an open
// answers with the view it left the tour on, for scripts and tests driving the tour.
function command(name: string, run: (argument?: unknown) => Promise<unknown>): vscode.Disposable {
  return vscode.commands.registerCommand(name, (argument?: unknown) =>
    run(argument).catch(reportFailure),
  )
}

export function activate(context: vscode.ExtensionContext): void {
  stepTint = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.rangeHighlightBackground"),
    isWholeLine: true,
  })
  const callArrows = createArrows()
  arrows = callArrows
  const inlineValues = createInlineValues()
  values = inlineValues
  decorations = [stepTint, ...callArrows.types, inlineValues.type]
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
  const panel = createNarration()
  narration = panel
  const tab = createTourTab((step) => {
    move("goto", { step }).catch(reportFailure)
  })
  tourTab = tab
  context.subscriptions.push(
    ...decorations,
    status,
    panel,
    tab,
    command("codetrail.openTour", openTour),
    command("codetrail.next", () => move("next")),
    command("codetrail.previous", () => move("prev")),
    command("codetrail.over", () => move("over")),
    command("codetrail.into", into),
    command("codetrail.out", () => move("out")),
    command("codetrail.toggleValues", toggleValues),
    command("codetrail.quit", quit),
  )
}

export function deactivate(): void {
  client?.close()
}
