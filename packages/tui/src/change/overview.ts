import {
  type OverviewView,
  loadTrek,
  openSession,
  sessionView,
  trekPath,
  viewContext,
} from "@srctrek/core"

/** The view before a trek's first stop, for the trek saved as `name` under `root`. */
export async function overviewOf(root: string, name: string): Promise<OverviewView | undefined> {
  const trek = await loadTrek(trekPath(root, name))
  const view = sessionView(openSession(trek), await viewContext(root, trek))
  return view.kind === "overview" ? view : undefined
}
