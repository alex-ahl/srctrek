import { type ResolvedChange, hasRange } from "../change/resolve"
import { buildLogTail, buildState } from "./background"
import { existingTourFor } from "./existing"
import { tourNameFor } from "./name"

/**
 * Where a change's tour stands: saved and ready, being built, failed (with the end of the
 * build's log), missing, never built, or empty: the change has no commits, so nothing to tour.
 */
export type TourStatus = Readonly<
  | { kind: "ready" | "building" | "missing" | "empty"; name: string }
  | { kind: "failed"; name: string; logTail: string[] }
>

// Enough of the log to see why a build ended; the whole log is in the git folder.
const LOG_TAIL_LINES = 8

// No changed repo moved: a branch still at its branch point, or a range from a commit to itself.
// Code as it is always has something to tour.
function isEmpty(change: ResolvedChange): boolean {
  if (change.code !== undefined) {
    return false
  }

  return change.repos
    .filter(hasRange)
    .every((repo) => repo.range.baseCommit === repo.range.headCommit)
}

/** The status of the change's tour, by the name a new tour of it would get. */
export async function tourStatus(root: string, change: ResolvedChange): Promise<TourStatus> {
  if (isEmpty(change)) {
    return { kind: "empty", name: await tourNameFor(change) }
  }

  const existing = await existingTourFor(root, change)
  if (existing !== undefined) {
    return { kind: "ready", name: existing }
  }

  const name = await tourNameFor(change)
  const state = await buildState(root, name)
  if (state === undefined) {
    return { kind: "missing", name }
  }

  if (state === "building") {
    return { kind: "building", name }
  }

  // "done" lands here too: the build saved a tour under this name that doesn't cover the
  // change, so building again would likely end the same way.
  return { kind: "failed", name, logTail: await buildLogTail(root, name, LOG_TAIL_LINES) }
}
