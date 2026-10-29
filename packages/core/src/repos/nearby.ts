import { readdir, realpath, stat } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import type { ResolvedChange } from "../change/resolve"
import { runGit } from "../git/run"

// A parent folder can hold hundreds of checkouts; the agent needs candidates, not all of them.
const NEARBY_LIMIT = 50

async function commonDir(dir: string): Promise<string> {
  return realpath(resolve(dir, await runGit(dir, ["rev-parse", "--git-common-dir"])))
}

// A folder holding its own repo: a .git folder, or a .git file (a worktree) of another repo
// than `own`, since a worktree of the same repo is the same code.
async function isOtherRepo(dir: string, own: string): Promise<boolean> {
  const git = await stat(join(dir, ".git")).catch(() => undefined)
  if (git === undefined) {
    return false
  }

  return git.isDirectory() || (await commonDir(dir).catch(() => own)) !== own
}

/**
 * Git repos next to the current one that the change doesn't open, as paths from `cwd`: where
 * a service the route leads into most often lives on the user's machine.
 */
export async function nearbyRepos(cwd: string, change: ResolvedChange): Promise<string[]> {
  const top = await realpath(await runGit(cwd, ["rev-parse", "--show-toplevel"]))
  const own = await commonDir(top)
  const opened = await Promise.all(change.repos.map((repo) => realpath(repo.dir).catch(() => "")))

  const parent = dirname(top)
  const entries = await readdir(parent, { withFileTypes: true })
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name))
    .filter((dir) => dir !== top && !opened.includes(dir))

  const checked = await Promise.all(
    folders.map(async (dir) => ((await isOtherRepo(dir, own)) ? [dir] : [])),
  )

  return checked
    .flat()
    .toSorted()
    .slice(0, NEARBY_LIMIT)
    .map((dir) => relative(cwd, dir))
}
