import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ResolvedChange } from "../change/resolve"
import { staleStepIds } from "../build/stale"
import { isBare } from "../git/base"
import { type LineChange, changedLines } from "../git/diff"
import { readFileAt } from "../git/read"
import { GitError, runGit } from "../git/run"
import { defaultCacheDir, fetchRevision } from "../repos/cache"
import { isRemote } from "../repos/entry"
import { repoDir } from "../repos/resolve"
import { editorCheckout } from "../repos/worktree"
import type { Tour } from "../schema/tour"
import type { OwnCheckout, ViewContext } from "./view"

type TourRepo = Tour["repos"][number]
type LinesByFile = ReadonlyMap<string, ReadonlyMap<number, LineChange>>

/** A repo a tour names that isn't where the tour says, or lacks the tour's commit. */
export class UnreachableRepoError extends Error {
  constructor(
    readonly repo: string,
    readonly source: string,
    reason: string,
  ) {
    super(`repo ${repo} (${source}): ${reason}`)
  }
}

async function hasCommit(dir: string, revision: string): Promise<boolean> {
  try {
    await runGit(dir, ["cat-file", "-e", `${revision}^{commit}`])
    return true
  } catch (error) {
    if (error instanceof GitError) {
      return false
    }

    throw error
  }
}

// The repo's git data, holding the tour's commit: a cached clone fetches it when it's missing.
async function gitDirOf(root: string, repo: TourRepo, cacheDir: string): Promise<string> {
  const dir = await repoDir(root, repo, cacheDir).catch((error: unknown) => {
    throw new UnreachableRepoError(
      repo.name,
      repo.source,
      error instanceof Error ? error.message : String(error),
    )
  })
  if (await hasCommit(dir, repo.revision)) {
    return dir
  }

  if (isRemote(repo.source)) {
    await fetchRevision(dir, repo.revision)
    return dir
  }

  throw new UnreachableRepoError(repo.name, repo.source, `no commit ${repo.revision}`)
}

function filesVisited(tour: Tour, repo: TourRepo): string[] {
  return [...new Set(tour.steps.filter((s) => s.repo === repo.name).map((s) => s.file))]
}

// The lines the repo's recorded range touches in each file the tour visits there.
async function linesOf(dir: string, tour: Tour, repo: TourRepo): Promise<LinesByFile> {
  const [base, head] = repo.range?.split(/\.{2,3}/) ?? []
  if (base === undefined || head === undefined) {
    return new Map()
  }

  const files = filesVisited(tour, repo)
  const lines = await Promise.all(files.map((file) => changedLines(dir, base, head, file)))

  return new Map(files.map((file, i) => [file, lines[i] ?? new Map()]))
}

// The user's own checkout of the repo: a local source with a working tree.
async function workTreeOf(dir: string, repo: TourRepo): Promise<string | undefined> {
  if (isRemote(repo.source) || (await isBare(dir))) {
    return undefined
  }

  return runGit(dir, ["rev-parse", "--show-toplevel"])
}

const contentOf = (path: string) => readFile(path, "utf8").catch(() => undefined)

// The files the tour visits whose copy in the user's checkout is the tour's version, edits
// and all, so the editor can open the user's own file.
async function ownCheckout(
  dir: string,
  tour: Tour,
  repo: TourRepo,
): Promise<OwnCheckout | undefined> {
  const root = await workTreeOf(dir, repo)
  if (root === undefined) {
    return undefined
  }

  const files = filesVisited(tour, repo)
  const matches = await Promise.all(
    files.map(async (file) => {
      const [mine, tours] = await Promise.all([
        contentOf(join(root, file)),
        readFileAt(dir, repo.revision, file),
      ])
      return tours !== undefined && mine === tours
    }),
  )

  return { root, files: new Set(files.filter((_, i) => matches[i])) }
}

/**
 * What the view of `tour` needs, from git: each repo checked out at the tour's revision, the
 * files the user's own checkout has at the tour's version, the lines its range touches, and,
 * given the change as it is now, the steps whose file moved on.
 * Repos are found from `root`, the folder the tour was built in.
 */
export async function viewContext(
  root: string,
  tour: Tour,
  options: { change?: ResolvedChange; cacheDir?: string } = {},
): Promise<ViewContext> {
  const cacheDir = options.cacheDir ?? defaultCacheDir()
  const repos = await Promise.all(
    tour.repos.map(async (repo) => {
      const dir = await gitDirOf(root, repo, cacheDir)
      const own = await ownCheckout(dir, tour, repo)
      // the tour's own copy is checked out only when some file the tour visits differs
      const everyFileOwn = own?.files.size === filesVisited(tour, repo).length
      const checkout =
        own !== undefined && everyFileOwn
          ? own.root
          : await editorCheckout(dir, repo.revision, cacheDir)
      return { name: repo.name, checkout, own, lines: await linesOf(dir, tour, repo) }
    }),
  )
  const stale = options.change === undefined ? [] : await staleStepIds(tour, options.change)

  return {
    roots: new Map(repos.map((repo) => [repo.name, repo.checkout])),
    own: new Map(repos.flatMap((repo) => (repo.own === undefined ? [] : [[repo.name, repo.own]]))),
    changedLines: new Map(repos.map((repo) => [repo.name, repo.lines])),
    stale: new Set(stale),
  }
}
