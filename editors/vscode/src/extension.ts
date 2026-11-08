import type { SessionView, StepView, TourEntry } from "@codetrail/core"
import * as vscode from "vscode"
import { type Arrows, createArrows } from "./arrows"
import { type ChangeMarks, createChangeMarks } from "./change-marks"
import { type Move, TrailClient } from "./client"
import { type InlineValues, createInlineValues } from "./inline-values"
import { type StepLens, createStepLens } from "./step-lens"
import { isNewFile, stepTags } from "./step-text"
import { type StopView, createStopView } from "./stop-view"
import { type TourTab, createTourTab } from "./tour-tab"
import { createToursView } from "./tours-view"
import { NOWHERE, callAt, lineAbove, placeOf, sameView, statusText, tourSummary } from "./view"

// The open tour's connection and where it is, at the edge as a server's current state is; one
// tour at a time.
let client: TrailClient | undefined
let current: SessionView | undefined
let stepTint: vscode.TextEditorDecorationType | undefined
let arrows: Arrows | undefined
let values: InlineValues | undefined
let changeMarks: ChangeMarks | undefined
let decorations: vscode.TextEditorDecorationType[] = []
let status: vscode.StatusBarItem | undefined
let stepLens: StepLens | undefined
let tourTab: TourTab | undefined
let stopView: StopView | undefined

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

// VS Code counts the empty line after a file's last newline; the tour doesn't.
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
  if (view.tour_copy) {
    // the tour's version of a file, kept in trail's cache, isn't for editing
    await vscode.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession")
  }

  stepLens?.show(view)
  // from the line above, so the actions above the step show rather than sit off the top
  const shown = new vscode.Range(lineAbove(place), 0, place.last, 0)
  editor.revealRange(shown, vscode.TextEditorRevealType.AtTop)
}

async function show(view: SessionView): Promise<void> {
  current = view
  // Escape in the tour tab ends the tour only at its end, not on the overview
  await vscode.commands.executeCommand("setContext", "codetrail.atEnd", view.kind === "end")
  await stopView?.show(view.kind === "step" ? view : null)
  if (status !== undefined) {
    status.text = statusText(view)
    status.show()
  }
  if (view.kind === "step") {
    tourTab?.hide()
    await showStep(view)
    return
  }

  stepLens?.show(null)
  clearDecorations()
  tourTab?.show(view)
}

function pickItem(entry: TourEntry): vscode.QuickPickItem {
  if (!entry.valid) {
    return { label: entry.name, description: entry.problem }
  }
  return { label: entry.name, description: entry.title, detail: tourSummary(entry) }
}

function startClient(): TrailClient {
  const folder = vscode.workspace.workspaceFolders?.[0]
  if (folder === undefined) {
    throw new Error("open the folder the tours were built in first")
  }
  return new TrailClient(serveCommand(), folder.uri.fsPath)
}

// The saved tours, from a trail serve started for the asking, so the list works with no tour open.
async function listTours(): Promise<readonly TourEntry[]> {
  const listing = startClient()
  try {
    await listing.initialize()
    return (await listing.tours()).tours
  } finally {
    listing.close()
  }
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
  // opens codetrail's sidebar on the stop, as starting a debug session opens Run and Debug
  await vscode.commands.executeCommand("codetrail.stop.focus")
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

// Back to the stop the tour is on, without moving the tour.
async function showCurrent(): Promise<SessionView | undefined> {
  if (current === undefined) {
    void vscode.window.showWarningMessage("codetrail: no tour is open; run Codetrail: Open Tour…")
    return undefined
  }
  await show(current)
  return current
}

// The stop's context code in VS Code's peek view over the step, so the tour stays where it is.
async function showContext(): Promise<void> {
  if (current?.kind !== "step") {
    vscode.window.setStatusBarMessage("codetrail: context is shown at a stop", 3000)
    return
  }
  if (current.context.length === 0) {
    vscode.window.setStatusBarMessage("codetrail: this stop has no context", 3000)
    return
  }

  const step = current
  await show(step)
  const locations = step.context.map(
    (ref) =>
      new vscode.Location(
        vscode.Uri.file(ref.path),
        new vscode.Range(ref.start_line - 1, 0, ref.end_line - 1, 0),
      ),
  )
  const place = placeOf(step)
  await vscode.commands.executeCommand(
    "editor.action.peekLocations",
    vscode.Uri.file(place.path),
    new vscode.Position(place.first, 0),
    locations,
    "peek",
  )
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
  stepLens?.show(null)
  tourTab?.hide()
  await stopView?.show(null)
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
  const marks = createChangeMarks(vscode.Uri.joinPath(context.extensionUri, "media"))
  changeMarks = marks
  decorations = [stepTint, ...callArrows.types, inlineValues.type, ...marks.types]
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
  const lens = createStepLens()
  stepLens = lens
  const goTo = (step: string): void => {
    move("goto", { step }).catch(reportFailure)
  }
  const tab = createTourTab(goTo)
  tourTab = tab
  const stop = createStopView(goTo)
  stopView = stop
  const tours = createToursView(listTours)
  context.subscriptions.push(
    ...decorations,
    status,
    lens,
    tab,
    stop,
    tours,
    command("codetrail.refreshTours", () => {
      tours.refresh()
      return Promise.resolve()
    }),
    command("codetrail.openTour", openTour),
    command("codetrail.next", () => move("next")),
    command("codetrail.previous", () => move("prev")),
    command("codetrail.over", () => move("over")),
    command("codetrail.into", into),
    command("codetrail.out", () => move("out")),
    command("codetrail.toggleValues", toggleValues),
    command("codetrail.current", showCurrent),
    command("codetrail.context", showContext),
    command("codetrail.quit", quit),
  )
}

export function deactivate(): void {
  client?.close()
}
