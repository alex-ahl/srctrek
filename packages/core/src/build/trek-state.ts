import { detectBase, isBaseBranch } from "../git/base"
import { branchToRead, isAncestor } from "../git/refs"
import { runGit } from "../git/run"
import { defaultCacheDir } from "../repos/cache"
import { isRemote } from "../repos/entry"
import { repoDir } from "../repos/resolve"
import type { Trek } from "../schema/trek"
import type { TrekEntry } from "../trek-entries"
import { loadTrek } from "../treks"
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
  | { kind: "done"; why: "merged" | "gone" | "committed" }
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

const rangeEnd = (repo: TrekRepo) => repo.range?.split(/\.{2,3}/)[1] ?? repo.revision

// A branch's work is merged when its last commit is in the base branch, unless it is the base.
async function isMerged(dir: string, branch: string, work: string): Promise<boolean> {
  const base = await detectBase(dir)
  return !isBaseBranch(base, branch) && isAncestor(dir, work, base)
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
  if (!head.uncommitted && (await isMerged(dir, head.name, end))) {
    return { kind: "done", why: "merged" }
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
async function movedState(trek: Trek, now: readonly Now[]): Promise<TrekState> {
  const moved = now.filter(({ left, commit }) => left !== commit)
  if (moved.length === 0) {
    return { kind: "current" }
  }

  if (moved.every((state) => state.uncommitted)) {
    return { kind: "done", why: "committed" }
  }

  return { kind: "stale", staleStops: await staleStops(trek, now), stops: stopIds(trek).size }
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
