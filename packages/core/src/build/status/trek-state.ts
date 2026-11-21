import { rangeCommits } from "../../schema/recorded-range"
import { detectBase, isBaseBranch } from "../../git/base"
import { branchToRead, isAncestor, upstreamOf } from "../../git/refs"
import { runGit } from "../../git/run"
import { defaultCacheDir } from "../../repos/cache"
import { isRemote } from "../../repos/entry"
import { repoDir } from "../../repos/resolve"
import type { Trek } from "../../schema/trek"
import type { TrekEntry } from "../../treks/entries"
import { loadTrek } from "../../treks/store"
import { type UnreachableRepo, unreachableRepo } from "./reachable"
import { staleStepIds } from "./stale"
import { stopIds } from "./stops"

/**
 * Where a saved trek stands against its branches now: current, where it left them; stale, a
 * branch moved on, with how many of its stops cite files changed since; done, its branch is
 * merged into the base branch or gone, or the uncommitted work it showed was committed since;
 * unreachable, a local repo it names can't be opened here; or unchecked, when telling would mean
 * fetching (a remote repo, a pull request).
 */
export type TrekState = Readonly<
  | { kind: "current" | "unchecked" }
  | { kind: "stale"; staleStops: number; stops: number }
  | { kind: "done"; why: "merged" | "pushed" | "gone" | "committed" }
  | { kind: "unreachable"; unreachable: UnreachableRepo }
>

type TrekRepo = Trek["repos"][number]
type Done = Extract<TrekState, { kind: "done" }>

// One repo of the trek: where it was when the trek was built and where it is now, or why that
// alone settles it.
type RepoState =
  | { kind: "now"; repo: TrekRepo; dir: string; left: string; commit: string; uncommitted: boolean }
  | Done
  | { kind: "unchecked" }

const rangeEnd = (repo: TrekRepo) => rangeCommits(repo.range)?.head ?? repo.revision

// How a branch's work has landed, if it has: merged, its last commit in the base branch; or, for
// the base branch itself, whose treks are of work not yet pushed, pushed to the branch it tracks.
async function landedAs(
  dir: string,
  branch: string,
  work: string,
): Promise<"merged" | "pushed" | undefined> {
  const base = await detectBase(dir)
  if (!isBaseBranch(base, branch)) {
    return (await isAncestor(dir, work, base)) ? "merged" : undefined
  }

  const upstream = await upstreamOf(dir, branch)
  return upstream !== undefined && (await isAncestor(dir, work, upstream)) ? "pushed" : undefined
}

// A changed repo's branch now. A snapshot of uncommitted work is in no branch, so it's compared
// from the commit the work was on.
async function changedRepoState(dir: string, repo: TrekRepo): Promise<RepoState> {
  const { head } = repo
  if (head?.kind !== "branch") {
    return { kind: "unchecked" }
  }

  const branch = await branchToRead(dir, head.name)
  if (branch === undefined) {
    return { kind: "done", why: "gone" }
  }

  const end = rangeEnd(repo)
  const left = head.uncommitted ? await runGit(dir, ["rev-parse", `${end}^`]) : end
  const landed = head.uncommitted ? undefined : await landedAs(dir, head.name, end)
  if (landed !== undefined) {
    return { kind: "done", why: landed }
  }

  const commit = await runGit(dir, ["rev-parse", branch.ref])
  return { kind: "now", repo, dir, left, commit, uncommitted: head.uncommitted }
}

async function repoState(root: string, repo: TrekRepo): Promise<RepoState> {
  if (isRemote(repo.source)) {
    return { kind: "unchecked" }
  }

  const dir = await repoDir(root, repo, defaultCacheDir())
  if (repo.range !== undefined) {
    return changedRepoState(dir, repo)
  }

  // code as it is: compared with what's checked out now
  const commit = await runGit(dir, ["rev-parse", "HEAD"])
  return { kind: "now", repo, dir, left: repo.revision, commit, uncommitted: false }
}

type Now = Extract<RepoState, { kind: "now" }>

// How many of the trek's stops cite files that differ at the repos' commits now.
async function staleStops(trek: Trek, repos: readonly Now[]): Promise<number> {
  const change = {
    repos: repos.map(({ repo, dir, commit }) => ({
      name: repo.name,
      source: repo.source,
      dir,
      revision: commit,
    })),
  }
  const stops = stopIds(trek)

  return (await staleStepIds(trek, change)).filter((id) => stops.has(id)).length
}

// Where the repos that can be checked put the trek: current until one moves; a snapshot whose
// branch moved on is a moment that's passed, its work committed (and perhaps changed since).
// Code as it is that moved on without touching a stop's file is still what the trek walks; a
// change that moved on has work the trek doesn't, whichever files it touched.
async function movedState(trek: Trek, now: readonly Now[]): Promise<TrekState> {
  const moved = now.filter(({ left, commit }) => left !== commit)
  if (moved.length === 0) {
    return { kind: "current" }
  }

  if (moved.every((state) => state.uncommitted)) {
    return { kind: "done", why: "committed" }
  }

  const stale = await staleStops(trek, now)
  const codeAsItIs = moved.every(({ repo }) => repo.range === undefined)
  return stale === 0 && codeAsItIs
    ? { kind: "current" }
    : { kind: "stale", staleStops: stale, stops: stopIds(trek).size }
}

/** Where `trek`, saved under `root`, stands against its branches and checkouts now. */
export async function trekState(root: string, trek: Trek): Promise<TrekState> {
  const unreachable = await unreachableRepo(root, trek)
  if (unreachable !== undefined) {
    return { kind: "unreachable", unreachable }
  }

  const states = await Promise.all(trek.repos.map((repo) => repoState(root, repo)))
  const now = states.filter((state) => state.kind === "now")
  if (now.length > 0) {
    return movedState(trek, now)
  }

  return states.find((state): state is Done => state.kind === "done") ?? { kind: "unchecked" }
}

/**
 * Where each valid trek among `entries` stands, by name. A trek whose state can't be worked out
 * (its repo's git fails) is left out, as unchecked.
 */
export async function trekStates(
  root: string,
  entries: readonly TrekEntry[],
): Promise<Map<string, TrekState>> {
  const stateOf = async (entry: TrekEntry): Promise<[string, TrekState][]> => {
    if (!entry.valid) {
      return []
    }

    try {
      return [[entry.name, await trekState(root, await loadTrek(entry.path))]]
    } catch {
      return []
    }
  }

  return new Map((await Promise.all(entries.map(stateOf))).flat())
}
