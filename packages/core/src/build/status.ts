import { type ResolvedChange, hasRange } from "../change/resolve"
import { buildLogTail, buildSavedTour, buildState } from "./background"
import { existingTourFor, loadValid } from "./existing"
import { staleStepIds } from "./stale"
import { pathExists } from "../files"
import { tourPath } from "../tours"
import { tourNameFor } from "./name"
import { type Trigger, loadTriggers } from "./triggers"

/**
 * Where a change's tour stands: saved and ready; stale, saved at commits the change has moved
 * on from, with how many of its steps cite files changed since; being built or failed (each
 * with the end of the build's log); missing, never built; or empty: the change has no commits,
 * so nothing to tour. For code with no trigger named, the triggers found instead of a tour.
 */
export type TourStatus = Readonly<
  | { kind: "ready" | "missing" | "empty"; name: string }
  | { kind: "stale"; name: string; staleSteps: number; steps: number }
  | { kind: "building" | "failed"; name: string; logTail: string[] }
  | { kind: "triggers"; name: string; triggers: TriggerTour[] }
>

/** A trigger found in the code, and where the tour that follows it stands. */
export type TriggerTour = Readonly<{ trigger: Trigger; tour: TourStatus }>

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

// Where a build stands when nothing it made is there to show.
async function buildStatus(root: string, name: string): Promise<TourStatus> {
  const state = await buildState(root, name)
  if (state === undefined) {
    return { kind: "missing", name }
  }

  if (state === "building") {
    return { kind: "building", name, logTail: await buildLogTail(root, name, LOG_TAIL_LINES) }
  }

  // The build saved its tour, which has since been removed: build it again, as if never built.
  if (await buildSavedTour(root, name)) {
    return { kind: "missing", name }
  }

  // "done" lands here too: the build saved a tour under this name that doesn't cover the
  // change, so building again would likely end the same way.
  return { kind: "failed", name, logTail: await buildLogTail(root, name, LOG_TAIL_LINES) }
}

// Plain --code finds the code's triggers: the list once found, else where finding them stands.
async function triggersStatus(root: string, change: ResolvedChange): Promise<TourStatus> {
  const name = await tourNameFor(change)
  const triggers = await loadTriggers(root, name, change)
  if (triggers !== undefined) {
    const tourOf = async (trigger: Trigger): Promise<TriggerTour> => {
      const tour = await tourStatus(root, { ...change, code: { trigger: trigger.name } })
      return { trigger, tour }
    }

    return { kind: "triggers", name, triggers: await Promise.all(triggers.map(tourOf)) }
  }

  return buildStatus(root, name)
}

// A tour saved under the change's name that no longer covers it: built at older commits.
async function staleStatus(
  root: string,
  name: string,
  change: ResolvedChange,
): Promise<TourStatus | undefined> {
  const path = tourPath(root, name)
  const tour = (await pathExists(path)) ? await loadValid(path) : undefined
  if (tour === undefined) {
    return undefined
  }

  const staleSteps = (await staleStepIds(tour, change)).length
  return { kind: "stale", name, staleSteps, steps: tour.steps.length }
}

// With no tour of the change as it is: a build under way or failed comes first, as it's what
// the user last asked for; else the older tour, stale; else whatever building left.
async function changedStatus(
  root: string,
  change: ResolvedChange,
  name: string,
): Promise<TourStatus> {
  const state = await buildState(root, name)
  if (state === "building" || state === "failed") {
    return buildStatus(root, name)
  }

  return (await staleStatus(root, name, change)) ?? buildStatus(root, name)
}

/** The status of the change's tour, by the name a new tour of it would get. */
export async function tourStatus(root: string, change: ResolvedChange): Promise<TourStatus> {
  if (change.code !== undefined && change.code.trigger === undefined) {
    return triggersStatus(root, change)
  }

  if (isEmpty(change)) {
    return { kind: "empty", name: await tourNameFor(change) }
  }

  const existing = await existingTourFor(root, change)
  if (existing !== undefined) {
    return { kind: "ready", name: existing }
  }

  return changedStatus(root, change, await tourNameFor(change))
}
