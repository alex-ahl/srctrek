import { type RepoWithRange, type ResolvedChange, hasRange } from "../change/resolve"
import type { Tour } from "../schema/tour"
import { pathExists } from "../files"
import { TourValidationError, listTours, loadTour, tourPath } from "../tours"
import { tourNameFor } from "./name"

// A tour records a changed repo's range as "<base commit>..<head commit>".
function rangeText(repo: RepoWithRange): string {
  return `${repo.range.baseCommit}..${repo.range.headCommit}`
}

// A tour covers the change when it has every changed repo at the same commits. Repos on the
// route without changes don't decide it: the agent may visit fewer of them, or more.
function covers(tour: Tour, change: ResolvedChange): boolean {
  return change.repos
    .filter(hasRange)
    .every((repo) =>
      tour.repos.some(
        (recorded) => recorded.name === repo.name && recorded.range === rangeText(repo),
      ),
    )
}

/** The tour saved at `path`, or none when it isn't valid. */
export async function loadValid(path: string): Promise<Tour | undefined> {
  try {
    return await loadTour(path)
  } catch (error) {
    if (error instanceof TourValidationError) {
      return undefined
    }

    throw error
  }
}

// A code tour of the same code: no ranges, and each repo it read at the revision it has now.
function readsSameCode(tour: Tour, change: ResolvedChange): boolean {
  const revisionNow = (name: string) => change.repos.find((repo) => repo.name === name)?.revision

  return tour.repos.every((recorded) => {
    const now = revisionNow(recorded.name)
    return recorded.range === undefined && (now === undefined || now === recorded.revision)
  })
}

// Code tours are found by name: several may cover the same code, one per trigger.
async function existingCodeTour(root: string, change: ResolvedChange): Promise<string | undefined> {
  const name = await tourNameFor(change)
  const path = tourPath(root, name)
  if (!(await pathExists(path))) {
    return undefined
  }

  const tour = await loadValid(path)
  return tour !== undefined && readsSameCode(tour, change) ? name : undefined
}

/** The name of a saved tour of exactly this change, if there is one; invalid tours don't count. */
export async function existingTourFor(
  root: string,
  change: ResolvedChange,
): Promise<string | undefined> {
  if (change.code !== undefined) {
    return existingCodeTour(root, change)
  }

  for (const name of await listTours(root)) {
    const tour = await loadValid(tourPath(root, name))
    if (tour !== undefined && covers(tour, change)) {
      return name
    }
  }

  return undefined
}
