import { type ResolvedChange, hasRange } from "../../change/resolve"
import { buildLogTail, buildSavedTrek, buildState } from "../agent/background"
import { existingTrekFor } from "./existing"
import { type UnreachableRepo, unreachableRepo } from "./reachable"
import { staleStepIds } from "./stale"
import { stopIds } from "./stops"
import { pathExists } from "../../files"
import { PROMPT_HASH } from "../../prompts/texts"
import { loadTrek, loadTrekOrProblem, trekPath } from "../../treks/store"
import { trekNameFor } from "./name"
import { type Trigger, loadTriggers } from "../triggers"
import { trekState } from "./trek-state"

/**
 * Where a change's trek stands: saved and ready, or built with an older guide than today's, or
 * saved but unreachable, naming a local repo that can't be opened here;
 * stale, saved at commits the change has moved on from, with how many of its stops cite files
 * changed since; unreadable, saved under the change's name but not a valid trek, with its first
 * problem; being built or failed (each with the end of the build's log); missing, never built;
 * or empty: the change has no commits, so nothing to trek. For code with no trigger named, the
 * triggers found instead of a trek.
 */
export type TrekStatus = Readonly<
  | { kind: "ready" | "older-guide" | "missing" | "empty"; name: string }
  | { kind: "unreadable"; name: string; problem: string }
  | { kind: "unreachable"; name: string; unreachable: UnreachableRepo }
  | { kind: "stale"; name: string; staleStops: number; stops: number }
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

// A trek saved under the change's name that doesn't cover it: built at older commits, or not a
// valid trek at all, such as one from another format version.
async function savedStatus(
  root: string,
  name: string,
  change: ResolvedChange,
): Promise<TrekStatus | undefined> {
  const path = trekPath(root, name)
  if (!(await pathExists(path))) {
    return undefined
  }

  const saved = await loadTrekOrProblem(path)
  if ("problem" in saved) {
    return { kind: "unreadable", name, problem: saved.problem }
  }

  const stops = stopIds(saved.trek)
  const staleStops = (await staleStepIds(saved.trek, change)).filter((id) => stops.has(id)).length
  return { kind: "stale", name, staleStops, stops: stops.size }
}

// A trek of the change: unreachable when it names a repo that can't be opened here, as nothing
// else matters until it can; else building while it's built again. A rebuild that failed says
// more than a trek built with an older guide, which it was to replace; a trek of today's guide
// stays ready, as it still is.
async function readyStatus(root: string, name: string): Promise<TrekStatus> {
  const trek = await loadTrek(trekPath(root, name))
  const unreachable = await unreachableRepo(root, trek)
  if (unreachable !== undefined) {
    return { kind: "unreachable", name, unreachable }
  }

  const state = await buildState(root, name)
  if (state === "building") {
    return buildStatus(root, name)
  }

  if (trek.prompt_hash === PROMPT_HASH) {
    return { kind: "ready", name }
  }

  return state === "failed" ? buildStatus(root, name) : { kind: "older-guide", name }
}

// With no trek of the change as it is: a build under way or failed comes first, as it's what
// the user last asked for; else the trek saved under its name; else whatever building left.
async function changedStatus(
  root: string,
  change: ResolvedChange,
  name: string,
): Promise<TrekStatus> {
  const state = await buildState(root, name)
  if (state === "building" || state === "failed") {
    return buildStatus(root, name)
  }

  return (await savedStatus(root, name, change)) ?? buildStatus(root, name)
}

// Whether a trek saved under `name` is one whose work has landed: merged into the base, its branch
// gone, or what it showed committed since. A long-lived branch, trekked again after a push,
// reuses its name for new work.
async function isDone(root: string, name: string): Promise<boolean> {
  const path = trekPath(root, name)
  if (!(await pathExists(path))) {
    return false
  }

  const saved = await loadTrekOrProblem(path)
  return "trek" in saved && (await trekState(root, saved.trek)).kind === "done"
}

// The change's name, or, while a trek whose work has landed holds it, the next one free:
// "development-2", so that trek stays as it was, listed with the done ones.
async function nameFor(root: string, change: ResolvedChange): Promise<string> {
  const name = await trekNameFor(change)
  let next = name
  for (let n = 2; await isDone(root, next); n += 1) {
    next = `${name}-${n}`
  }

  return next
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
    return readyStatus(root, existing)
  }

  return changedStatus(root, change, await nameFor(root, change))
}
