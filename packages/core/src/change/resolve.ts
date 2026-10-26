import type { ResolvedRange } from "../git/range"
import { GitError, runGit } from "../git/run"
import { defaultCacheDir } from "../repos/cache"
import { readReposList } from "../repos/list"
import {
  type ChangedRepo,
  resolvePullRequest,
  resolveRangeChange,
  resolveUnchangedRepo,
} from "../repos/resolve"
import type { ChangeArguments, ChangeSource } from "./arguments"

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

/** Every repo the trail may pass through, changed ones first. */
export type ResolvedChange = { repos: ResolvedRepo[] }

function resolveChangeSource(
  cwd: string,
  change: ChangeSource,
  cacheDir: string,
): Promise<ChangedRepo> {
  if (change.kind === "pull-request") {
    return resolvePullRequest(change.pr, cacheDir)
  }

  return resolveRangeChange(cwd, change.repo, change.range, cacheDir)
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

/**
 * Resolves trail's arguments, read in `cwd`, to every repo at an exact commit: the changes,
 * the repos given without a range, and those in the current repo's .codetrail/repos.
 */
export async function resolveChange(
  cwd: string,
  args: ChangeArguments,
  cacheDir = defaultCacheDir(),
): Promise<ResolvedChange> {
  const changed = await Promise.all(
    args.changes.map((change) => resolveChangeSource(cwd, change, cacheDir)),
  )
  const given = await Promise.all(
    args.unchanged.map((entry) => resolveUnchangedRepo(cwd, entry, cacheDir)),
  )
  const listed = await resolveListedRepos(cwd, cacheDir)

  const repos = withoutRepeats([...changed.map(atHead), ...given, ...listed])
  assertUniqueNames(repos)

  return { repos }
}
