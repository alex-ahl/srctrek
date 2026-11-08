import { type ResolvedChange, hasRange } from "../change/resolve"
import { buildLogTail, buildSavedTrek, buildState } from "./background"
import { existingTrekFor, loadValid } from "./existing"
import { staleStepIds } from "./stale"
import { pathExists } from "../files"
import { trekPath } from "../treks"
import { trekNameFor } from "./name"
import { type Trigger, loadTriggers } from "./triggers"

/**
 * Where a change's trek stands: saved and ready; stale, saved at commits the change has moved
 * on from, with how many of its steps cite files changed since; being built or failed (each
 * with the end of the build's log); missing, never built; or empty: the change has no commits,
 * so nothing to trek. For code with no trigger named, the triggers found instead of a trek.
 */
export type TrekStatus = Readonly<
  | { kind: "ready" | "missing" | "empty"; name: string }
  | { kind: "stale"; name: string; staleSteps: number; steps: number }
  | { kind: "building" | "failed"; name: string; logTail: string[] }
  | { kind: "triggers"; name: string; triggers: TriggerTrek[] }
>

/** A trigger found in the code, and where the trek that follows it stands. */
export type TriggerTrek = Readonly<{ trigger: Trigger; trek: TrekStatus }>

// Enough of the log to see why a build ended; the whole log is in the git folder.
const LOG_TAIL_LINES = 8

// No changed repo moved: a branch still at its branch point, or a range from a commit to itself.
// Code as it is always has something to trek.
function isEmpty(change: ResolvedChange): boolean {
  if (change.code !== undefined) {
    return false
  }

  return change.repos
    .filter(hasRange)
    .every((repo) => repo.range.baseCommit === repo.range.headCommit)
}

// Where a build stands when nothing it made is there to show.
async function buildStatus(root: string, name: string): Promise<TrekStatus> {
  const state = await buildState(root, name)
  if (state === undefined) {
    return { kind: "missing", name }
  }

  if (state === "building") {
    return { kind: "building", name, logTail: await buildLogTail(root, name, LOG_TAIL_LINES) }
  }

  // The build saved its trek, which has since been removed: build it again, as if never built.
  if (await buildSavedTrek(root, name)) {
    return { kind: "missing", name }
  }

  // "done" lands here too: the build saved a trek under this name that doesn't cover the
  // change, so building again would likely end the same way.
  return { kind: "failed", name, logTail: await buildLogTail(root, name, LOG_TAIL_LINES) }
}

// Plain --code finds the code's triggers: the list once found, else where finding them stands.
async function triggersStatus(root: string, change: ResolvedChange): Promise<TrekStatus> {
  const name = await trekNameFor(change)
  const triggers = await loadTriggers(root, name, change)
  if (triggers !== undefined) {
    const trekOf = async (trigger: Trigger): Promise<TriggerTrek> => {
      const trek = await trekStatus(root, { ...change, code: { trigger: trigger.name } })
      return { trigger, trek }
    }

    return { kind: "triggers", name, triggers: await Promise.all(triggers.map(trekOf)) }
  }

  return buildStatus(root, name)
}

// A trek saved under the change's name that no longer covers it: built at older commits.
async function staleStatus(
  root: string,
  name: string,
  change: ResolvedChange,
): Promise<TrekStatus | undefined> {
  const path = trekPath(root, name)
  const trek = (await pathExists(path)) ? await loadValid(path) : undefined
  if (trek === undefined) {
    return undefined
  }

  const staleSteps = (await staleStepIds(trek, change)).length
  return { kind: "stale", name, staleSteps, steps: trek.steps.length }
}

// With no trek of the change as it is: a build under way or failed comes first, as it's what
// the user last asked for; else the older trek, stale; else whatever building left.
async function changedStatus(
  root: string,
  change: ResolvedChange,
  name: string,
): Promise<TrekStatus> {
  const state = await buildState(root, name)
  if (state === "building" || state === "failed") {
    return buildStatus(root, name)
  }

  return (await staleStatus(root, name, change)) ?? buildStatus(root, name)
}

/** The status of the change's trek, by the name a new trek of it would get. */
export async function trekStatus(root: string, change: ResolvedChange): Promise<TrekStatus> {
  if (change.code !== undefined && change.code.trigger === undefined) {
    return triggersStatus(root, change)
  }

  if (isEmpty(change)) {
    return { kind: "empty", name: await trekNameFor(change) }
  }

  const existing = await existingTrekFor(root, change)
  if (existing !== undefined) {
    return { kind: "ready", name: existing }
  }

  return changedStatus(root, change, await trekNameFor(change))
}
