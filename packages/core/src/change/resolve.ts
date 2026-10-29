import { resolve } from "node:path"
import type { ResolvedRange } from "../git/range"
import { branchToRead } from "../git/refs"
import { GitError, runGit } from "../git/run"
import { defaultCacheDir } from "../repos/cache"
import { type RepoEntry, isRemote } from "../repos/entry"
import { readReposList } from "../repos/list"
import {
  type ChangedRepo,
  resolvePullRequest,
  resolveRangeChange,
  resolveUnchangedRepo,
} from "../repos/resolve"
import { snapshotWorkingTree } from "../git/snapshot"
import type { ChangeArguments, ChangeSource } from "./arguments"
import type { CodeTour } from "./options"

/**
 * A repo of the change at an exact commit: its head when it changed (with its range), else
 * the revision it's read at. `dir` is where its git data is read from.
 */
export type ResolvedRepo = {
  name: string
  source: string
  dir: string
  revision: string
  range?: ResolvedRange
}

/** A repo of the change that the change touches. */
export type RepoWithRange = ResolvedRepo & { range: ResolvedRange }

export function hasRange(repo: ResolvedRepo): repo is RepoWithRange {
  return repo.range !== undefined
}

/**
 * Every repo the trail may pass through, changed ones first; for a tour of code as it is,
 * no repo has a range, and `code` holds its trigger.
 */
export type ResolvedChange = { repos: ResolvedRepo[]; code?: CodeTour | undefined }

// Uncommitted work lives in a local checkout, at its HEAD; a pull request or a remote repo has
// none.
function takesUncommitted(change: ChangeSource): boolean {
  return change.kind === "range" && !isRemote(change.repo.source) && change.range.head === "HEAD"
}

function resolveChangeSource(
  cwd: string,
  change: ChangeSource,
  cacheDir: string,
  uncommitted: boolean,
): Promise<ChangedRepo> {
  if (change.kind === "pull-request") {
    return resolvePullRequest(change.pr, cacheDir)
  }

  const options = { uncommitted: uncommitted && takesUncommitted(change) }
  return resolveRangeChange(cwd, change.repo, change.range, cacheDir, options)
}

function atHead(repo: ChangedRepo): ResolvedRepo {
  return { ...repo, revision: repo.range.headCommit }
}

/**
 * The top of the repo trail runs in, which repo paths in the repos list and in proposals are
 * relative to; none when it runs outside one, as with a pull request given from anywhere.
 */
export async function currentRepoTop(cwd: string): Promise<string | undefined> {
  try {
    return await runGit(cwd, ["rev-parse", "--show-toplevel"])
  } catch (error) {
    if (error instanceof GitError) {
      return undefined
    }

    throw error
  }
}

// The current repo's .codetrail/repos, its paths relative to that repo's top.
async function resolveListedRepos(cwd: string, cacheDir: string): Promise<ResolvedRepo[]> {
  const top = await currentRepoTop(cwd)
  if (top === undefined) {
    return []
  }

  const entries = await readReposList(top)

  return Promise.all(entries.map((entry) => resolveUnchangedRepo(top, entry, cacheDir)))
}

// A repo given twice, or listed and also changed, is kept once: where it first appears.
// Repos are compared by where their git data is, since sources can name one repo differently.
function withoutRepeats(repos: ResolvedRepo[]): ResolvedRepo[] {
  const appearsEarlier = (repo: ResolvedRepo, index: number) =>
    repos.slice(0, index).some((earlier) => earlier.dir === repo.dir)

  return repos.filter((repo, index) => !appearsEarlier(repo, index))
}

// Steps name their repo, so two repos can't share a name.
function assertUniqueNames(repos: ResolvedRepo[]): void {
  const seen = new Map<string, ResolvedRepo>()
  for (const repo of repos) {
    const clash = seen.get(repo.name)
    if (clash !== undefined) {
      throw new Error(
        `two repos named ${repo.name}: ${clash.source} and ${repo.source}; ` +
          `name one in .codetrail/repos (name = path)`,
      )
    }

    seen.set(repo.name, repo)
  }
}

// A repo toured as it is: a local one at what's checked out (or a snapshot of the working tree,
// with uncommitted work), unless pinned; a URL at its default branch.
async function resolveCodeRepo(
  cwd: string,
  entry: RepoEntry,
  cacheDir: string,
  uncommitted: boolean,
): Promise<ResolvedRepo> {
  if (isRemote(entry.source) || entry.revision !== undefined) {
    return resolveUnchangedRepo(cwd, entry, cacheDir)
  }

  const repo = await resolveUnchangedRepo(cwd, { ...entry, revision: "HEAD" }, cacheDir)
  if (!uncommitted) {
    return repo
  }

  return { ...repo, revision: await snapshotWorkingTree(repo.dir) }
}

/**
 * Resolves trail's arguments, read in `cwd`, to every repo at an exact commit: the changes,
 * the repos given without a range, and those in the current repo's .codetrail/repos.
 */
export async function resolveChange(
  cwd: string,
  args: ChangeArguments,
  cacheDir = defaultCacheDir(),
): Promise<ResolvedChange> {
  if (args.uncommitted && args.code === undefined && !args.changes.some(takesUncommitted)) {
    throw new Error("--uncommitted needs a range ending at HEAD in a local repo")
  }

  const changed = await Promise.all(
    args.changes.map((change) => resolveChangeSource(cwd, change, cacheDir, args.uncommitted)),
  )
  const given = await Promise.all(
    args.unchanged.map((entry) =>
      args.code === undefined
        ? resolveUnchangedRepo(cwd, entry, cacheDir)
        : resolveCodeRepo(cwd, entry, cacheDir, args.uncommitted),
    ),
  )
  const listed = await resolveListedRepos(cwd, cacheDir)

  const repos = withoutRepeats([...changed.map(atHead), ...given, ...listed])
  assertUniqueNames(repos)

  return args.code === undefined ? { repos } : { repos, code: args.code }
}

type Behind = { commits: number; upstream: string }

/**
 * Which revision a repo added to the route is read at, and how sure that is: on the branch
 * the work is on, as part of the change, shown as the ref read ("feature", or "origin/feature"
 * when only that is there) and perhaps behind its upstream as of the last fetch;
 * at a revision the source pins; or at its default branch, and why, when neither applies.
 */
export type ReadAt =
  | { kind: "work-branch"; branch: string; shown: string; behind?: Behind | undefined }
  | { kind: "pinned"; revision: string }
  | { kind: "default"; why: string }

// How far a local branch trails the branch it tracks, as of the last fetch; none when it
// tracks nothing or is level with it. Nothing is fetched: the user's repo is left as it is.
async function behindUpstream(dir: string, branch: string): Promise<Behind | undefined> {
  try {
    const upstream = await runGit(dir, ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`])
    const commits = Number(await runGit(dir, ["rev-list", "--count", `${branch}..${upstream}`]))

    return commits > 0 ? { commits, upstream } : undefined
  } catch (error) {
    if (error instanceof GitError) {
      return undefined
    }

    throw error
  }
}

// The repo as a change ending at the work's branch, from where it left its base, and the ref
// read; none when the repo has no such branch. A local repo is read from its own branch, else
// from a remote-tracking one (a reviewer's usual case), named in full so a tag isn't taken
// for it; a URL's branch is fetched by name.
async function onWorkBranch(
  top: string,
  entry: RepoEntry,
  branch: string,
  cacheDir: string,
): Promise<{ repo: ResolvedRepo; ref: string; shown: string } | undefined> {
  const toRead = isRemote(entry.source)
    ? { ref: branch, shown: branch }
    : await branchToRead(resolve(top, entry.source), branch).catch(() => undefined)
  if (toRead === undefined) {
    return undefined
  }

  const spec = { base: undefined, head: toRead.ref, mode: "since-branch-point" as const }
  try {
    return { ...toRead, repo: atHead(await resolveRangeChange(top, entry, spec, cacheDir)) }
  } catch (error) {
    if (error instanceof GitError) {
      return undefined
    }

    throw error
  }
}

function defaultWhy(entry: RepoEntry, branches: string[]): string {
  if (branches.length === 0) {
    return "the change isn't on a branch to match"
  }

  return `${entry.source} has no branch ${branches.join(" or ")}`
}

// The repo to add, and what it's read at: pinned, else the first of the work's branches it
// has, else its default branch.
async function routeRepo(
  top: string,
  entry: RepoEntry,
  branches: string[],
  cacheDir: string,
): Promise<{ repo: ResolvedRepo; readAt: ReadAt }> {
  if (entry.revision !== undefined) {
    const repo = await resolveUnchangedRepo(top, entry, cacheDir)
    return { repo, readAt: { kind: "pinned", revision: entry.revision } }
  }

  for (const branch of branches) {
    const found = await onWorkBranch(top, entry, branch, cacheDir)
    if (found !== undefined) {
      const { repo, ref, shown } = found
      // only a local branch has an upstream to trail; a remote-tracking one is the upstream
      const behind = ref.startsWith("refs/heads/")
        ? await behindUpstream(repo.dir, branch)
        : undefined
      return { repo, readAt: { kind: "work-branch", branch, shown, behind } }
    }
  }

  const repo = await resolveUnchangedRepo(top, entry, cacheDir)
  return { repo, readAt: { kind: "default", why: defaultWhy(entry, branches) } }
}

/**
 * The change with one more repo on the route, its source relative to the current repo: on
 * one of `branches`, the ones the work is on, as part of the change when it has it, else at
 * its default branch; and what it was read at. A repo already on the route, or a name already
 * taken, is refused.
 */
export async function withRouteRepo(
  cwd: string,
  change: ResolvedChange,
  entry: RepoEntry,
  branches: string[],
  cacheDir = defaultCacheDir(),
): Promise<{ change: ResolvedChange; readAt: ReadAt }> {
  const top = (await currentRepoTop(cwd)) ?? cwd
  const { repo, readAt } = await routeRepo(top, entry, branches, cacheDir)
  if (change.repos.some((existing) => existing.dir === repo.dir)) {
    throw new Error(`${entry.source} is already on the route`)
  }

  const repos = [...change.repos, repo]
  assertUniqueNames(repos)

  return { change: { ...change, repos }, readAt }
}
