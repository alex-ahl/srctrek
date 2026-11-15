import type { TrekEntry } from "@srctrek/core"
import * as vscode from "vscode"

export type TreksView = { refresh: () => void }

function itemOf(entry: TrekEntry): vscode.TreeItem {
  const item = new vscode.TreeItem(entry.name)
  if (!entry.valid) {
    item.description = entry.problem
    item.iconPath = new vscode.ThemeIcon("warning")
    return item
  }
  item.description = `${entry.title} · ${trekSummary(entry)}`
  item.tooltip = `${entry.title}\n${trekSummary(entry)}`
  item.command = { command: "srctrek.openTrek", title: "Open Trek", arguments: [entry.name] }
  return item
}

/** The srctrek sidebar's Treks view: the saved treks, each opening on a click. */
export function createTreksView(
  listTreks: () => Promise<readonly TrekEntry[]>,
): TreksView & vscode.Disposable {
  const changed = new vscode.EventEmitter<undefined>()
  const provider: vscode.TreeDataProvider<TrekEntry> = {
    onDidChangeTreeData: changed.event,
    getTreeItem: itemOf,
    getChildren: async (parent) => (parent === undefined ? [...(await listTreks())] : []),
  }
  const view = vscode.window.createTreeView("srctrek.treks", { treeDataProvider: provider })

  return {
    refresh: () => {
      changed.fire(undefined)
    },
    dispose: () => {
      view.dispose()
      changed.dispose()
    },
  }
}

/** A valid trek's size and its likely-wrong flags, for the lists of treks. */
export function trekSummary(entry: Extract<TrekEntry, { valid: true }>): string {
  const flags = entry.highFlags > 0 ? ` · ${String(entry.highFlags)} likely wrong` : ""
  return `${String(entry.steps)} stops${flags}`
}
