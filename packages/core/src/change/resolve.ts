import type { ResolvedRange } from "../git/range"
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

// The top of the repo trail runs in; none when it runs outside one, as with a pull request
// given from anywhere.
async function currentRepoTop(cwd: string): Promise<string | undefined> {
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

/**
 * The change with one more repo on the route, read as a listed repo is: its source relative to
 * the current repo, at its default branch unless pinned. A repo already on the route, or a
 * name already taken, is refused.
 */
export async function withRouteRepo(
  cwd: string,
  change: ResolvedChange,
  entry: RepoEntry,
  cacheDir = defaultCacheDir(),
): Promise<ResolvedChange> {
  const top = (await currentRepoTop(cwd)) ?? cwd
  const added = await resolveUnchangedRepo(top, entry, cacheDir)
  if (change.repos.some((repo) => repo.dir === added.dir)) {
    throw new Error(`${entry.source} is already on the route`)
  }

  const repos = [...change.repos, added]
  assertUniqueNames(repos)

  return { ...change, repos }
}
