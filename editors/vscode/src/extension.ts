import type { SessionView, StepView, TrekEntry } from "@srctrek/core"
import * as vscode from "vscode"
import { type Arrows, createArrows } from "./code/arrows"
import { type ChangeMarks, createChangeMarks } from "./code/change-marks"
import { type Move, TrekClient } from "./client"
import { type InlineValues, createInlineValues } from "./code/inline-values"
import { type StepLens, createStepLens } from "./code/step-lens"
import { isNewFile, stepTags } from "./step-text"
import { type StopView, createStopView } from "./sidebar/stop"
import { type TrekTab, createTrekTab } from "./pages/trek-tab"
import { createTreksView } from "./sidebar/treks"
import { callAt } from "./code/call-marks"
import { NOWHERE, sameView } from "./moves"
import { lineAbove, placeOf } from "./place"
import { trekSummary } from "./sidebar/treks"
import { statusText } from "./step-text"

// The pieces the extension draws with, made once when it starts.
type Ui = Readonly<{
  stepTint: vscode.TextEditorDecorationType
  arrows: Arrows
  values: InlineValues
  changeMarks: ChangeMarks
  // every decoration type, cleared together when the trek moves on
  decorations: readonly vscode.TextEditorDecorationType[]
  status: vscode.StatusBarItem
  stepLens: StepLens & vscode.Disposable
  trekTab: TrekTab & vscode.Disposable
  stopView: StopView & vscode.Disposable
}>

// The open trek's connection and where it is: the one thing that changes, at the edge as a
// server's current state is; one trek at a time.
let session: Readonly<{ client: TrekClient | undefined; current: SessionView | undefined }> = {
  client: undefined,
  current: undefined,
}

function serveCommand(): string[] {
  return (
    vscode.workspace.getConfiguration("srctrek").get<string[]>("serveCommand") ?? ["trek", "serve"]
  )
}

function reportFailure(error: unknown): void {
  void vscode.window.showErrorMessage(
    `srctrek: ${error instanceof Error ? error.message : String(error)}`,
  )
}

// The last step's tint and arrows stay in its editor otherwise, when it's still visible.
function clearDecorations(ui: Ui): void {
  for (const editor of vscode.window.visibleTextEditors) {
    for (const type of ui.decorations) {
      editor.setDecorations(type, [])
    }
  }
}

// VS Code counts the empty line after a file's last newline; the trek doesn't.
function isNewFileIn(document: vscode.TextDocument, view: StepView): boolean {
  const last = document.lineAt(document.lineCount - 1)
  const lines = last.isEmptyOrWhitespace ? document.lineCount - 1 : document.lineCount
  return isNewFile(view, lines)
}

// The step's lines tinted, its calls, values, and changed lines marked, in its editor.
function markStep(ui: Ui, editor: vscode.TextEditor, view: StepView, newFile: boolean): void {
  const place = placeOf(view)
  clearDecorations(ui)
  editor.setDecorations(ui.stepTint, [new vscode.Range(place.first, 0, place.last, 0)])
  ui.arrows.show(editor, view)
  ui.values.show(editor, view)
  ui.changeMarks.show(editor, view, newFile)
}

// The cursor on the step's first line, the step shown from the line above, so the actions above
// it show rather than sit off the top.
function revealStep(editor: vscode.TextEditor, view: StepView): void {
  const place = placeOf(view)
  editor.selection = new vscode.Selection(place.first, 0, place.first, 0)
  const shown = new vscode.Range(lineAbove(place), 0, place.last, 0)
  editor.revealRange(shown, vscode.TextEditorRevealType.AtTop)
}

async function showStep(ui: Ui, view: StepView): Promise<void> {
  const uri = vscode.Uri.file(placeOf(view).path)
  const editor = await vscode.window.showTextDocument(uri, { preview: false })
  const newFile = isNewFileIn(editor.document, view)
  ui.status.text = statusText(view, stepTags(view, newFile))
  markStep(ui, editor, view, newFile)
  if (view.trek_copy) {
    // the trek's version of a file, kept in srctrek's cache, isn't for editing
    await vscode.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession")
  }

  ui.stepLens.show(view)
  revealStep(editor, view)
}

async function show(ui: Ui, view: SessionView): Promise<void> {
  session = { ...session, current: view }
  // Escape in the trek tab ends the trek only at its end, not on the overview
  await vscode.commands.executeCommand("setContext", "srctrek.atEnd", view.kind === "end")
  await ui.stopView.show(view.kind === "step" ? view : null)
  ui.status.text = statusText(view)
  ui.status.show()
  if (view.kind === "step") {
    ui.trekTab.hide()
    await showStep(ui, view)
    return
  }

  ui.stepLens.show(null)
  clearDecorations(ui)
  ui.trekTab.show(view)
}

function pickItem(entry: TrekEntry): vscode.QuickPickItem {
  if (!entry.valid) {
    return { label: entry.name, description: entry.problem }
  }
  return { label: entry.name, description: entry.title, detail: trekSummary(entry) }
}

function startClient(): TrekClient {
  const folder = vscode.workspace.workspaceFolders?.[0]
  if (folder === undefined) {
    throw new Error("open the folder the treks were built in first")
  }
  return new TrekClient(serveCommand(), folder.uri.fsPath)
}

// The saved treks, from a trek serve started for the asking, so the list works with no trek open.
async function listTreks(): Promise<readonly TrekEntry[]> {
  const listing = startClient()
  try {
    await listing.initialize()
    return (await listing.treks()).treks
  } finally {
    listing.close()
  }
}

async function pickTrek(running: TrekClient): Promise<string | undefined> {
  const { treks } = await running.treks()
  const picked = await vscode.window.showQuickPick(treks.map(pickItem), {
    placeHolder: "Trek to open",
  })
  return picked?.label
}

// Given a trek's name, as a test or a keybinding can, it opens that one without asking.
async function openTrek(ui: Ui, name?: unknown): Promise<SessionView | undefined> {
  session.client?.close()
  const client = startClient()
  session = { client, current: undefined }
  await client.initialize()
  const trek = typeof name === "string" ? name : await pickTrek(client)
  if (trek === undefined) {
    return undefined
  }

  await vscode.commands.executeCommand("setContext", "srctrek.open", true)
  // opens srctrek's sidebar on the stop, as starting a debug session opens Run and Debug
  await vscode.commands.executeCommand("srctrek.stop.focus")
  const view = await client.open(trek)
  await show(ui, view)
  return view
}

function warnNoTrek(): undefined {
  void vscode.window.showWarningMessage("srctrek: no trek is open; run srctrek: Open Trek…")
  return undefined
}

async function move(ui: Ui, to: Move, params?: object): Promise<SessionView | undefined> {
  const { client, current: before } = session
  if (client === undefined) {
    return warnNoTrek()
  }

  const after = await client.move(to, params)
  // redrawing the same view would snap the cursor back to the step's first line
  if (before !== undefined && sameView(before, after)) {
    vscode.window.setStatusBarMessage(`srctrek: ${NOWHERE[to]}`, 4000)
    return after
  }
  await show(ui, after)
  return after
}

function callAtCursor(): string | undefined {
  const { current } = session
  const editor = vscode.window.activeTextEditor
  if (current?.kind !== "step" || editor === undefined) {
    return undefined
  }
  const line = editor.selection.active.line + 1
  return callAt(current, editor.document.uri.fsPath, line)?.id
}

// Into the call on the cursor's line; elsewhere the server picks the first not yet visited.
function into(ui: Ui): Promise<SessionView | undefined> {
  const target = callAtCursor()
  return move(ui, "into", target === undefined ? undefined : { target })
}

// Back to the stop the trek is on, without moving the trek.
async function showCurrent(ui: Ui): Promise<SessionView | undefined> {
  const { current } = session
  if (current === undefined) {
    return warnNoTrek()
  }

  await show(ui, current)
  return current
}

// The stop's context code, each piece under its reason, in the Stop view; the trek stays where it
// is.
async function showContext(ui: Ui): Promise<void> {
  const { current } = session
  if (current?.kind !== "step") {
    vscode.window.setStatusBarMessage("srctrek: context is shown at a stop", 3000)
    return
  }
  if (current.context.length === 0) {
    vscode.window.setStatusBarMessage("srctrek: this stop has no context", 3000)
    return
  }

  await vscode.commands.executeCommand("srctrek.stop.focus")
  ui.stopView.reveal("context")
}

function toggleValues(ui: Ui): Promise<void> {
  const shown = ui.values.toggle()
  vscode.window.setStatusBarMessage(`srctrek: values ${shown ? "shown" : "hidden"}`, 3000)
  return Promise.resolve()
}

async function quit(ui: Ui): Promise<void> {
  session.client?.close()
  session = { client: undefined, current: undefined }
  ui.status.hide()
  ui.stepLens.show(null)
  ui.trekTab.hide()
  await ui.stopView.show(null)
  clearDecorations(ui)
  await vscode.commands.executeCommand("setContext", "srctrek.open", false)
}

// A command that reports a failure instead of throwing it into VS Code's log. A move or an open
// answers with the view it left the trek on, for scripts and tests driving the trek.
function command(name: string, run: (argument?: unknown) => Promise<unknown>): vscode.Disposable {
  return vscode.commands.registerCommand(name, (argument?: unknown) =>
    run(argument).catch(reportFailure),
  )
}

// The pieces the extension draws with; a stop clicked in its pages or views goes to it.
function createUi(context: vscode.ExtensionContext, goTo: (step: string) => void): Ui {
  const stepTint = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.rangeHighlightBackground"),
    isWholeLine: true,
  })
  const arrows = createArrows()
  const values = createInlineValues()
  const changeMarks = createChangeMarks(vscode.Uri.joinPath(context.extensionUri, "media"))

  return {
    stepTint,
    arrows,
    values,
    changeMarks,
    decorations: [stepTint, ...arrows.types, values.type, ...changeMarks.types],
    status: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left),
    stepLens: createStepLens(),
    trekTab: createTrekTab(goTo),
    stopView: createStopView(goTo),
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const goTo = (step: string): void => {
    move(ui, "goto", { step }).catch(reportFailure)
  }
  const ui = createUi(context, goTo)
  const treks = createTreksView(listTreks)
  context.subscriptions.push(
    ...ui.decorations,
    ui.status,
    ui.stepLens,
    ui.trekTab,
    ui.stopView,
    treks,
    command("srctrek.refreshTreks", () => {
      treks.refresh()
      return Promise.resolve()
    }),
    command("srctrek.openTrek", (name) => openTrek(ui, name)),
    command("srctrek.next", () => move(ui, "next")),
    command("srctrek.previous", () => move(ui, "prev")),
    command("srctrek.over", () => move(ui, "over")),
    command("srctrek.into", () => into(ui)),
    command("srctrek.out", () => move(ui, "out")),
    command("srctrek.toggleValues", () => toggleValues(ui)),
    command("srctrek.current", () => showCurrent(ui)),
    command("srctrek.context", () => showContext(ui)),
    command("srctrek.quit", () => quit(ui)),
  )
}

export function deactivate(): void {
  session.client?.close()
}
