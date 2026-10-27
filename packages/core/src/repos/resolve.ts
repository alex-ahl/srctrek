import { resolve } from "node:path"
import { detectBase } from "../git/base"
import { type RangeSpec, type ResolvedRange, resolveRange } from "../git/range"
import { GitError, runGit } from "../git/run"
import { snapshotWorkingTree } from "../git/snapshot"
import { cachedRepo, defaultCacheDir, fetchRefs } from "./cache"
import { type RepoEntry, folderName, isRemote } from "./entry"
import type { PullRequest } from "./pull-request"

/**
 * A repo on the route without changes: the tour's record of it (no range), and `dir`, where
 * its git data is read from.
 */
export type UnchangedRepo = { name: string; source: string; revision: string; dir: string }

/** A changed repo and its range; `dir` is where its git data is read from. */
export type ChangedRepo = { name: string; source: string; dir: string; range: ResolvedRange }

async function repoTopLevel(dir: string, source: string): Promise<string> {
  try {
    return await runGit(dir, ["rev-parse", "--show-toplevel"])
  } catch (error) {
    if (error instanceof GitError) {
      throw new Error(`not a git repo: ${source}`, { cause: error })
    }

    throw error
  }
}

// The cached clone of a remote repo, fetched so its branches, tags and `refs` are current.
async function fetchedRepo(cacheDir: string, url: string, refs: string[] = []): Promise<string> {
  const dir = await cachedRepo(cacheDir, url)
  await fetchRefs(dir, refs)

  return dir
}

// Where an entry's git data is: its cached clone for a URL, else the top of the repo at its
// path, relative to `baseDir`.
async function repoDir(baseDir: string, entry: RepoEntry, cacheDir: string): Promise<string> {
  if (isRemote(entry.source)) {
    return fetchedRepo(cacheDir, entry.source)
  }

  return repoTopLevel(resolve(baseDir, entry.source), entry.source)
}

/**
 * Resolves an entry to the commit the tour reads. A local path is relative to `baseDir` (the
 * folder the entry was written for); a URL is read from its cached clone. Without a revision,
 * the repo's base branch is used; without a name, the repo is named after its folder. The
 * source is kept as written, so a tour that records it stays valid on other machines.
 */
export async function resolveUnchangedRepo(
  baseDir: string,
  entry: RepoEntry,
  cacheDir = defaultCacheDir(),
): Promise<UnchangedRepo> {
  const dir = await repoDir(baseDir, entry, cacheDir)

  const revision = entry.revision ?? (await detectBase(dir))
  const commit = await runGit(dir, ["rev-parse", "--verify", `${revision}^{commit}`])

  return { name: entry.name ?? folderName(dir), source: entry.source, revision: commit, dir }
}

/**
 * Resolves a range in a repo, found as resolveUnchangedRepo finds one. With `uncommitted`, the
 * range ends at a snapshot of the working tree instead of its head.
 */
export async function resolveRangeChange(
  baseDir: string,
  entry: RepoEntry,
  spec: RangeSpec,
  cacheDir = defaultCacheDir(),
  { uncommitted = false } = {},
): Promise<ChangedRepo> {
  const dir = await repoDir(baseDir, entry, cacheDir)
  const head = uncommitted ? await snapshotWorkingTree(dir) : spec.head
  const range = await resolveRange(dir, { ...spec, head })

  return { name: entry.name ?? folderName(dir), source: entry.source, dir, range }
}

/**
 * Fetches a pull request into the cache and resolves its range: from where it branched off
 * the default branch to its head, the view the pull request page shows.
 */
export async function resolvePullRequest(
  pr: PullRequest,
  cacheDir = defaultCacheDir(),
): Promise<ChangedRepo> {
  const dir = await fetchedRepo(cacheDir, pr.cloneUrl, [pr.ref])

  const base = await detectBase(dir)
  const range = await resolveRange(dir, { base, head: pr.ref, mode: "since-branch-point" })

  return { name: pr.name, source: pr.cloneUrl, dir, range }
}
