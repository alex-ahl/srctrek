import { TourValidationError, listTours, loadTour, tourPath } from "@codetrail/core"

export type TourEntry =
  | { name: string; path: string; valid: true; title: string; steps: number; highFlags: number }
  | { name: string; path: string; valid: false; problem: string }

async function loadEntry(root: string, name: string): Promise<TourEntry> {
  const path = tourPath(root, name)
  try {
    const tour = await loadTour(path)
    const highFlags = tour.steps.filter((s) => s.uncertain?.severity === "high").length
    return { name, path, valid: true, title: tour.title, steps: tour.steps.length, highFlags }
  } catch (error) {
    if (!(error instanceof TourValidationError)) throw error
    return { name, path, valid: false, problem: error.issues[0] ?? "invalid tour" }
  }
}

/** Every saved tour under `root`; invalid ones stay listed with their first problem. */
export async function loadTourEntries(root: string): Promise<TourEntry[]> {
  const names = await listTours(root)
  return Promise.all(names.map((name) => loadEntry(root, name)))
}
