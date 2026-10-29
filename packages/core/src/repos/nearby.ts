import { readdir, realpath } from "node:fs/promises"
import { basename, dirname, join, relative, resolve } from "node:path"
import type { ResolvedChange } from "../change/resolve"
import { runGit } from "../git/run"
import { workBranches } from "./branch"
import { gitDataOf } from "./git-files"
import { hasBranch } from "../git/refs"

// A folder of checkouts can hold hundreds; the agent needs candidates, not all of them.
const NEARBY_LIMIT = 50

// Git processes run at once while checking a folder of repos for the work's branch.
const GIT_AT_ONCE = 16

// `each` over `items`, a batch of GIT_AT_ONCE at a time, results in order.
async function inBatches<T, R>(items: T[], each: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let start = 0; start < items.length; start += GIT_AT_ONCE) {
    const batch = items.slice(start, start + GIT_AT_ONCE)
    results.push(...(await Promise.all(batch.map(each))))
  }

  return results
}

// The folder holding a repo: a clone's own folder (its .git inside it), the project folder
// of a bare repo kept beside its worktrees (project/.bare with project/main), or a bare repo
// itself (api.git). Its siblings are the other repos.
function homeOf(common: string): string {
  return basename(common).startsWith(".") ? dirname(common) : common
}

async function commonDir(dir: string): Promise<string> {
  return realpath(resolve(dir, await runGit(dir, ["rev-parse", "--git-common-dir"])))
}

// A folder holding a repo other than `own`: a worktree of the same repo is the same code.
async function otherRepo(dir: string, own: string): Promise<string[]> {
  const gitData = await gitDataOf(dir)

  return gitData === undefined || gitData === own ? [] : [dir]
}

/** A repo next to the current one: its path from `cwd`, and the work's branch, if it has it. */
export type NearbyRepo = { path: string; branch?: string | undefined }

async function nearbyRepo(cwd: string, dir: string, branches: string[]): Promise<NearbyRepo> {
  const path = relative(cwd, dir)
  for (const branch of branches) {
    if (await hasBranch(dir, branch)) {
      return { path, branch }
    }
  }

  return { path }
}

/** The repos next to this one, those on the work's branch first, and how many weren't named. */
export type Nearby = { repos: NearbyRepo[]; leftOut: number }

// Repos on the work's branch come first, so the cap never drops the ones most likely needed.
function capped(repos: NearbyRepo[]): Nearby {
  const ordered = [
    ...repos.filter(({ branch }) => branch !== undefined),
    ...repos.filter(({ branch }) => branch === undefined),
  ]

  return {
    repos: ordered.slice(0, NEARBY_LIMIT),
    leftOut: Math.max(0, ordered.length - NEARBY_LIMIT),
  }
}

/**
 * Git repos next to the current one that the change doesn't open: where a service the route
 * leads into most often lives on the user's machine. Each says whether it has a branch the
 * work is on, which by convention holds the work's side in that repo.
 */
export async function nearbyRepos(cwd: string, change: ResolvedChange): Promise<Nearby> {
  const own = await commonDir(cwd)
  const home = homeOf(own)
  const opened = await Promise.all(change.repos.map((repo) => realpath(repo.dir).catch(() => "")))

  const parent = dirname(home)
  const entries = await readdir(parent, { withFileTypes: true })
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name))
    .filter((dir) => dir !== home && !opened.includes(dir))

  const candidates = (await Promise.all(folders.map((dir) => otherRepo(dir, own)))).flat()
  const branches = await workBranches(cwd, change)
  const repos = await inBatches(candidates.toSorted(), (dir) => nearbyRepo(cwd, dir, branches))

  return capped(repos)
}
