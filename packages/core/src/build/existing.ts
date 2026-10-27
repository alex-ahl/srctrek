import { type RepoWithRange, type ResolvedChange, hasRange } from "../change/resolve"
import type { Tour } from "../schema/tour"
import { TourValidationError, listTours, loadTour, tourPath } from "../tours"

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

async function loadValid(path: string): Promise<Tour | undefined> {
  try {
    return await loadTour(path)
  } catch (error) {
    if (error instanceof TourValidationError) {
      return undefined
    }

    throw error
  }
}

/** The name of a saved tour of exactly this change, if there is one; invalid tours don't count. */
export async function existingTourFor(
  root: string,
  change: ResolvedChange,
): Promise<string | undefined> {
  for (const name of await listTours(root)) {
    const tour = await loadValid(tourPath(root, name))
    if (tour !== undefined && covers(tour, change)) {
      return name
    }
  }

  return undefined
}
