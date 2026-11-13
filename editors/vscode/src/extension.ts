import type { SessionView, StepView, TrekEntry } from "@srctrek/core"
import * as vscode from "vscode"
import { type Arrows, createArrows } from "./arrows"
import { type ChangeMarks, createChangeMarks } from "./change-marks"
import { type Move, TrekClient } from "./client"
import { type InlineValues, createInlineValues } from "./inline-values"
import { type StepLens, createStepLens } from "./step-lens"
import { isNewFile, stepTags } from "./step-text"
import { type StopView, createStopView } from "./stop-view"
import { type TrekTab, createTrekTab } from "./trek-tab"
import { createTreksView } from "./treks-view"
import { NOWHERE, callAt, lineAbove, placeOf, sameView, statusText, trekSummary } from "./view"

// The open trek's connection and where it is, at the edge as a server's current state is; one
// trek at a time.
let client: TrekClient | undefined
let current: SessionView | undefined
let stepTint: vscode.TextEditorDecorationType | undefined
let arrows: Arrows | undefined
let values: InlineValues | undefined
let changeMarks: ChangeMarks | undefined
let decorations: vscode.TextEditorDecorationType[] = []
let status: vscode.StatusBarItem | undefined
let stepLens: StepLens | undefined
let trekTab: TrekTab | undefined
let stopView: StopView | undefined

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
function clearDecorations(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    for (const type of decorations) {
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

async function showStep(view: StepView): Promise<void> {
  const place = placeOf(view)
  const uri = vscode.Uri.file(place.path)
  const editor = await vscode.window.showTextDocument(uri, { preview: false })
  const newFile = isNewFileIn(editor.document, view)
  if (status !== undefined) {
    status.text = statusText(view, stepTags(view, newFile))
  }
  const range = new vscode.Range(place.first, 0, place.last, 0)
  editor.selection = new vscode.Selection(place.first, 0, place.first, 0)
  clearDecorations()
  if (stepTint !== undefined) {
    editor.setDecorations(stepTint, [range])
  }
  arrows?.show(editor, view)
  values?.show(editor, view)
  changeMarks?.show(editor, view, newFile)
  if (view.trek_copy) {
    // the trek's version of a file, kept in srctrek's cache, isn't for editing
    await vscode.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession")
  }

  stepLens?.show(view)
  // from the line above, so the actions above the step show rather than sit off the top
  const shown = new vscode.Range(lineAbove(place), 0, place.last, 0)
  editor.revealRange(shown, vscode.TextEditorRevealType.AtTop)
}

async function show(view: SessionView): Promise<void> {
  current = view
  // Escape in the trek tab ends the trek only at its end, not on the overview
  await vscode.commands.executeCommand("setContext", "srctrek.atEnd", view.kind === "end")
  await stopView?.show(view.kind === "step" ? view : null)
  if (status !== undefined) {
    status.text = statusText(view)
    status.show()
  }
  if (view.kind === "step") {
    trekTab?.hide()
    await showStep(view)
    return
  }

  stepLens?.show(null)
  clearDecorations()
  trekTab?.show(view)
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
async function openTrek(name?: unknown): Promise<SessionView | undefined> {
  client?.close()
  client = startClient()
  await client.initialize()
  const trek = typeof name === "string" ? name : await pickTrek(client)
  if (trek === undefined) {
    return undefined
  }

  await vscode.commands.executeCommand("setContext", "srctrek.open", true)
  // opens srctrek's sidebar on the stop, as starting a debug session opens Run and Debug
  await vscode.commands.executeCommand("srctrek.stop.focus")
  const view = await client.open(trek)
  await show(view)
  return view
}

async function move(to: Move, params?: object): Promise<SessionView | undefined> {
  if (client === undefined) {
    void vscode.window.showWarningMessage("srctrek: no trek is open; run srctrek: Open Trek…")
    return undefined
  }

  const before = current
  const after = await client.move(to, params)
  // redrawing the same view would snap the cursor back to the step's first line
  if (before !== undefined && sameView(before, after)) {
    vscode.window.setStatusBarMessage(`srctrek: ${NOWHERE[to]}`, 4000)
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

// Back to the stop the trek is on, without moving the trek.
async function showCurrent(): Promise<SessionView | undefined> {
  if (current === undefined) {
    void vscode.window.showWarningMessage("srctrek: no trek is open; run srctrek: Open Trek…")
    return undefined
  }
  await show(current)
  return current
}

// The stop's context code, each piece under its reason, in the Stop view; the trek stays where it
// is.
async function showContext(): Promise<void> {
  if (current?.kind !== "step") {
    vscode.window.setStatusBarMessage("srctrek: context is shown at a stop", 3000)
    return
  }
  if (current.context.length === 0) {
    vscode.window.setStatusBarMessage("srctrek: this stop has no context", 3000)
    return
  }

  await vscode.commands.executeCommand("srctrek.stop.focus")
  stopView?.reveal("context")
}

function toggleValues(): Promise<void> {
  const shown = values?.toggle() ?? false
  vscode.window.setStatusBarMessage(`srctrek: values ${shown ? "shown" : "hidden"}`, 3000)
  return Promise.resolve()
}

async function quit(): Promise<void> {
  client?.close()
  client = undefined
  current = undefined
  status?.hide()
  stepLens?.show(null)
  trekTab?.hide()
  await stopView?.show(null)
  clearDecorations()
  await vscode.commands.executeCommand("setContext", "srctrek.open", false)
}

// A command that reports a failure instead of throwing it into VS Code's log. A move or an open
// answers with the view it left the trek on, for scripts and tests driving the trek.
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
  const marks = createChangeMarks(vscode.Uri.joinPath(context.extensionUri, "media"))
  changeMarks = marks
  decorations = [stepTint, ...callArrows.types, inlineValues.type, ...marks.types]
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
  const lens = createStepLens()
  stepLens = lens
  const goTo = (step: string): void => {
    move("goto", { step }).catch(reportFailure)
  }
  const tab = createTrekTab(goTo)
  trekTab = tab
  const stop = createStopView(goTo)
  stopView = stop
  const treks = createTreksView(listTreks)
  context.subscriptions.push(
    ...decorations,
    status,
    lens,
    tab,
    stop,
    treks,
    command("srctrek.refreshTreks", () => {
      treks.refresh()
      return Promise.resolve()
    }),
    command("srctrek.openTrek", openTrek),
    command("srctrek.next", () => move("next")),
    command("srctrek.previous", () => move("prev")),
    command("srctrek.over", () => move("over")),
    command("srctrek.into", into),
    command("srctrek.out", () => move("out")),
    command("srctrek.toggleValues", toggleValues),
    command("srctrek.current", showCurrent),
    command("srctrek.context", showContext),
    command("srctrek.quit", quit),
  )
}

export function deactivate(): void {
  client?.close()
}
