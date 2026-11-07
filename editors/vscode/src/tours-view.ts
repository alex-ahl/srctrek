import type { TourEntry } from "@codetrail/core"
import * as vscode from "vscode"
import { tourSummary } from "./view"

export type ToursView = { refresh: () => void }

function itemOf(entry: TourEntry): vscode.TreeItem {
  const item = new vscode.TreeItem(entry.name)
  if (!entry.valid) {
    item.description = entry.problem
    item.iconPath = new vscode.ThemeIcon("warning")
    return item
  }
  item.description = `${entry.title} · ${tourSummary(entry)}`
  item.tooltip = `${entry.title}\n${tourSummary(entry)}`
  item.command = { command: "codetrail.openTour", title: "Open Tour", arguments: [entry.name] }
  return item
}

/** The codetrail sidebar's Tours view: the saved tours, each opening on a click. */
export function createToursView(
  listTours: () => Promise<readonly TourEntry[]>,
): ToursView & vscode.Disposable {
  const changed = new vscode.EventEmitter<undefined>()
  const provider: vscode.TreeDataProvider<TourEntry> = {
    onDidChangeTreeData: changed.event,
    getTreeItem: itemOf,
    getChildren: async (parent) => (parent === undefined ? [...(await listTours())] : []),
  }
  const view = vscode.window.createTreeView("codetrail.tours", { treeDataProvider: provider })

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
