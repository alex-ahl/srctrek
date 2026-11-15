import { errorText } from "../error-text"
import { rangeCommits } from "../schema/recorded-range"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ResolvedChange } from "../change/resolve"
import { staleStepIds } from "../build/status/stale"
import { isBare } from "../git/base"
import { hasCommit } from "../git/refs"
import { type LineChange, changedLines } from "../git/diff"
import { readFileAt } from "../git/read"
import { runGit } from "../git/run"
import { defaultCacheDir, fetchRevision } from "../repos/cache"
import { isRemote } from "../repos/entry"
import { repoDir } from "../repos/resolve"
import { editorCheckout } from "../repos/worktree"
import type { Trek } from "../schema/trek"
import type { OwnCheckout, ViewContext } from "./view"

type TrekRepo = Trek["repos"][number]
type LinesByFile = ReadonlyMap<string, ReadonlyMap<number, LineChange>>

/** A repo a trek names that isn't where the trek says, or lacks the trek's commit. */
export class UnreachableRepoError extends Error {
  constructor(
    readonly repo: string,
    readonly source: string,
    reason: string,
  ) {
    super(`repo ${repo} (${source}): ${reason}`)
  }
}

// The repo's git data, holding the trek's commit: a cached clone fetches it when it's missing.
async function gitDirOf(root: string, repo: TrekRepo, cacheDir: string): Promise<string> {
  const dir = await repoDir(root, repo, cacheDir).catch((error: unknown) => {
    throw new UnreachableRepoError(repo.name, repo.source, errorText(error))
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

function filesVisited(trek: Trek, repo: TrekRepo): string[] {
  return [...new Set(trek.steps.filter((s) => s.repo === repo.name).map((s) => s.file))]
}

// The lines the repo's recorded range touches in each file the trek visits there.
async function linesOf(dir: string, trek: Trek, repo: TrekRepo): Promise<LinesByFile> {
  const range = rangeCommits(repo.range)
  if (range === undefined) {
    return new Map()
  }

  const files = filesVisited(trek, repo)
  const lines = await Promise.all(
    files.map((file) => changedLines(dir, range.base, range.head, file)),
  )

  return new Map(files.map((file, i) => [file, lines[i] ?? new Map()]))
}

// The user's own checkout of the repo: a local source with a working tree.
async function workTreeOf(dir: string, repo: TrekRepo): Promise<string | undefined> {
  if (isRemote(repo.source) || (await isBare(dir))) {
    return undefined
  }

  return runGit(dir, ["rev-parse", "--show-toplevel"])
}

const contentOf = (path: string) => readFile(path, "utf8").catch(() => undefined)

// The files the trek visits whose copy in the user's checkout is the trek's version, edits
// and all, so the editor can open the user's own file.
async function ownCheckout(
  dir: string,
  trek: Trek,
  repo: TrekRepo,
): Promise<OwnCheckout | undefined> {
  const root = await workTreeOf(dir, repo)
  if (root === undefined) {
    return undefined
  }

  const files = filesVisited(trek, repo)
  const matches = await Promise.all(
    files.map(async (file) => {
      const [mine, treks] = await Promise.all([
        contentOf(join(root, file)),
        readFileAt(dir, repo.revision, file),
      ])
      return treks !== undefined && mine === treks
    }),
  )

  return { root, files: new Set(files.filter((_, i) => matches[i])) }
}

/**
 * What the view of `trek` needs, from git: each repo checked out at the trek's revision, the
 * files the user's own checkout has at the trek's version, the lines its range touches, and,
 * given the change as it is now, the steps whose file moved on.
 * Repos are found from `root`, the folder the trek was built in.
 */
export async function viewContext(
  root: string,
  trek: Trek,
  options: { change?: ResolvedChange; cacheDir?: string } = {},
): Promise<ViewContext> {
  const cacheDir = options.cacheDir ?? defaultCacheDir()
  const repos = await Promise.all(
    trek.repos.map(async (repo) => {
      const dir = await gitDirOf(root, repo, cacheDir)
      const own = await ownCheckout(dir, trek, repo)
      // the trek's own copy is checked out only when some file the trek visits differs
      const everyFileOwn = own?.files.size === filesVisited(trek, repo).length
      const checkout =
        own !== undefined && everyFileOwn
          ? own.root
          : await editorCheckout(dir, repo.revision, cacheDir)
      return { name: repo.name, checkout, own, lines: await linesOf(dir, trek, repo) }
    }),
  )
  const stale = options.change === undefined ? [] : await staleStepIds(trek, options.change)

  return {
    roots: new Map(repos.map((repo) => [repo.name, repo.checkout])),
    own: new Map(repos.flatMap((repo) => (repo.own === undefined ? [] : [[repo.name, repo.own]]))),
    changedLines: new Map(repos.map((repo) => [repo.name, repo.lines])),
    stale: new Set(stale),
  }
}
