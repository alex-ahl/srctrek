import type { ResolvedChange } from "../change/resolve"
import { staleStepIds } from "../build/stale"
import { type LineChange, changedLines } from "../git/diff"
import { GitError, runGit } from "../git/run"
import { defaultCacheDir, fetchRevision } from "../repos/cache"
import { isRemote } from "../repos/entry"
import { repoDir } from "../repos/resolve"
import { editorCheckout } from "../repos/worktree"
import type { Tour } from "../schema/tour"
import type { ViewContext } from "./view"

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

// The lines the repo's recorded range touches in each file the tour visits there.
async function linesOf(dir: string, tour: Tour, repo: TourRepo): Promise<LinesByFile> {
  const [base, head] = repo.range?.split(/\.{2,3}/) ?? []
  if (base === undefined || head === undefined) {
    return new Map()
  }

  const files = [...new Set(tour.steps.filter((s) => s.repo === repo.name).map((s) => s.file))]
  const lines = await Promise.all(files.map((file) => changedLines(dir, base, head, file)))

  return new Map(files.map((file, i) => [file, lines[i] ?? new Map()]))
}

/**
 * What the view of `tour` needs, from git: each repo checked out at the tour's revision, the
 * lines its range touches, and, given the change as it is now, the steps whose file moved on.
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
      const checkout = await editorCheckout(dir, repo.revision, cacheDir)
      return { name: repo.name, checkout, lines: await linesOf(dir, tour, repo) }
    }),
  )
  const stale = options.change === undefined ? [] : await staleStepIds(tour, options.change)

  return {
    roots: new Map(repos.map((repo) => [repo.name, repo.checkout])),
    changedLines: new Map(repos.map((repo) => [repo.name, repo.lines])),
    stale: new Set(stale),
  }
}
