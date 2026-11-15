import { stopIds } from "../build/status/stops"
import type { RangeHead } from "../change/head"
import type { Trek } from "../schema/trek"
import { listTreks, loadTrekOrProblem, trekPath } from "./store"

/**
 * A saved trek, for lists of treks: a valid one's title, stops, likely-wrong flags, when it was
 * built, how many repos it passes through, whether it follows code as it is rather than a change,
 * and each changed repo's branch or pull request it was built from; else its first problem.
 */
export type TrekEntry =
  | {
      name: string
      path: string
      valid: true
      title: string
      steps: number
      highFlags: number
      createdAt: string
      repos: number
      code: boolean
      heads: { repo: string; head: RangeHead }[]
    }
  | { name: string; path: string; valid: false; problem: string }

// A valid trek as the list shows it.
function entryOf(name: string, path: string, trek: Trek): TrekEntry {
  const highFlags = trek.steps.filter((s) => s.uncertain?.severity === "high").length

  // a code trek reads every repo at a revision; a change trek has a range in at least one
  const code = trek.repos.every((repo) => repo.range === undefined)

  return {
    name,
    path,
    valid: true,
    title: trek.title,
    steps: stopIds(trek).size,
    highFlags,
    createdAt: trek.created_at,
    repos: trek.repos.length,
    code,
    heads: trek.repos.flatMap((repo) =>
      repo.head === undefined ? [] : [{ repo: repo.name, head: repo.head }],
    ),
  }
}

async function loadEntry(root: string, name: string): Promise<TrekEntry> {
  const path = trekPath(root, name)
  const loaded = await loadTrekOrProblem(path)

  return "trek" in loaded
    ? entryOf(name, path, loaded.trek)
    : { name, path, valid: false, problem: loaded.problem }
}

/** Every saved trek under `root`; invalid ones stay listed with their first problem. */
export async function loadTrekEntries(root: string): Promise<TrekEntry[]> {
  const names = await listTreks(root)

  return Promise.all(names.map((name) => loadEntry(root, name)))
}
