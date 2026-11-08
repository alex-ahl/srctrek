import { TrekValidationError, listTreks, loadTrek, trekPath } from "./treks"

export type TrekEntry =
  | { name: string; path: string; valid: true; title: string; steps: number; highFlags: number }
  | { name: string; path: string; valid: false; problem: string }

async function loadEntry(root: string, name: string): Promise<TrekEntry> {
  const path = trekPath(root, name)
  try {
    const trek = await loadTrek(path)
    const highFlags = trek.steps.filter((s) => s.uncertain?.severity === "high").length
    // stops, as the editors number them: context steps are opened from the step they explain
    const steps = trek.steps.filter((s) => s.kind !== "context").length

    return { name, path, valid: true, title: trek.title, steps, highFlags }
  } catch (error) {
    if (!(error instanceof TrekValidationError)) {
      throw error
    }

    return { name, path, valid: false, problem: error.issues[0] ?? "invalid trek" }
  }
}

/** Every saved trek under `root`; invalid ones stay listed with their first problem. */
export async function loadTrekEntries(root: string): Promise<TrekEntry[]> {
  const names = await listTreks(root)

  return Promise.all(names.map((name) => loadEntry(root, name)))
}
