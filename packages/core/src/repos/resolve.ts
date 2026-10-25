import { resolve } from "node:path"
import { detectBase } from "../git/base"
import { type ResolvedRange, resolveRange } from "../git/range"
import { GitError, runGit } from "../git/run"
import { cachedRepo, defaultCacheDir, fetchRefs } from "./cache"
import { type RepoEntry, folderName, isRemote } from "./entry"
import type { PullRequest } from "./pull-request"

/**
 * A repo on the route without changes: the tour's record of it (no range), and `dir`, where
 * its git data is read from.
 */
export type UnchangedRepo = { name: string; source: string; revision: string; dir: string }

/** A pull request's repo and range; `dir` is its cached clone. */
export type PullRequestChange = { name: string; source: string; dir: string; range: ResolvedRange }

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
  const dir = isRemote(entry.source)
    ? await fetchedRepo(cacheDir, entry.source)
    : await repoTopLevel(resolve(baseDir, entry.source), entry.source)

  const revision = entry.revision ?? (await detectBase(dir))
  const commit = await runGit(dir, ["rev-parse", "--verify", `${revision}^{commit}`])

  return { name: entry.name ?? folderName(dir), source: entry.source, revision: commit, dir }
}

/**
 * Fetches a pull request into the cache and resolves its range: from where it branched off
 * the default branch to its head, the view the pull request page shows.
 */
export async function resolvePullRequest(
  pr: PullRequest,
  cacheDir = defaultCacheDir(),
): Promise<PullRequestChange> {
  const dir = await fetchedRepo(cacheDir, pr.cloneUrl, [pr.ref])

  const base = await detectBase(dir)
  const range = await resolveRange(dir, { base, head: pr.ref, mode: "since-branch-point" })

  return { name: pr.name, source: pr.cloneUrl, dir, range }
}
