import { recordedRange } from "../../schema/recorded-range"
import { type ResolvedChange, hasRange } from "../../change/resolve"
import type { Trek } from "../../schema/trek"
import { pathExists } from "../../files"
import { listTreks, loadTrekOrProblem, trekPath } from "../../treks"
import { trekNameFor } from "./name"

// A trek covers the change when it has every changed repo at the same commits. Repos on the
// route without changes don't decide it: the agent may visit fewer of them, or more.
function covers(trek: Trek, change: ResolvedChange): boolean {
  return change.repos
    .filter(hasRange)
    .every((repo) =>
      trek.repos.some(
        (recorded) =>
          recorded.name === repo.name &&
          recorded.range === recordedRange(repo.range.baseCommit, repo.range.headCommit),
      ),
    )
}

// The trek saved at `path`, or none when it isn't valid.
async function validTrek(path: string): Promise<Trek | undefined> {
  const loaded = await loadTrekOrProblem(path)
  return "trek" in loaded ? loaded.trek : undefined
}

// A code trek of the same code: no ranges, and each repo it read at the revision it has now.
function readsSameCode(trek: Trek, change: ResolvedChange): boolean {
  const revisionNow = (name: string) => change.repos.find((repo) => repo.name === name)?.revision

  return trek.repos.every((recorded) => {
    const now = revisionNow(recorded.name)
    return recorded.range === undefined && (now === undefined || now === recorded.revision)
  })
}

// Code treks are found by name: several may cover the same code, one per trigger.
async function existingCodeTrek(root: string, change: ResolvedChange): Promise<string | undefined> {
  const name = await trekNameFor(change)
  const path = trekPath(root, name)
  if (!(await pathExists(path))) {
    return undefined
  }

  const trek = await validTrek(path)
  return trek !== undefined && readsSameCode(trek, change) ? name : undefined
}

/** The name of a saved trek of exactly this change, if there is one; invalid treks don't count. */
export async function existingTrekFor(
  root: string,
  change: ResolvedChange,
): Promise<string | undefined> {
  if (change.code !== undefined) {
    return existingCodeTrek(root, change)
  }

  for (const name of await listTreks(root)) {
    const trek = await validTrek(trekPath(root, name))
    if (trek !== undefined && covers(trek, change)) {
      return name
    }
  }

  return undefined
}
