import { readFile, realpath, stat } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathExists } from "../files"

// Looking over a folder of hundreds of repos, a git process for each is too slow; these read
// the few files git keeps for the answers instead.

// The folder a .git file points to: "gitdir: <path>", relative to the folder holding it.
async function pointedTo(dir: string, file: string): Promise<string | undefined> {
  const text = await readFile(file, "utf8").catch(() => "")
  const [, path] = /^gitdir: (.+)$/m.exec(text) ?? []

  return path === undefined ? undefined : resolve(dir, path.trim())
}

/**
 * Where a folder's repo keeps its shared git data, if the folder holds a repo: its .git
 * folder, or what its .git file points to, and for a worktree, the repo it belongs to.
 */
export async function gitDataOf(dir: string): Promise<string | undefined> {
  const dotGit = join(dir, ".git")
  const entry = await stat(dotGit).catch(() => undefined)
  if (entry === undefined) {
    return undefined
  }

  const gitDir = entry.isDirectory() ? dotGit : await pointedTo(dir, dotGit)
  if (gitDir === undefined) {
    return undefined
  }

  // A worktree's own git folder names the repo's shared one in its "commondir" file.
  const common = await readFile(join(gitDir, "commondir"), "utf8")
    .then((text) => resolve(gitDir, text.trim()))
    .catch(() => gitDir)

  return realpath(common).catch(() => undefined)
}

/** Whether the repo whose shared git data is `gitData` has a local branch named `branch`. */
export async function hasBranchIn(gitData: string, branch: string): Promise<boolean> {
  if (await pathExists(join(gitData, "refs", "heads", branch))) {
    return true
  }

  const packed = await readFile(join(gitData, "packed-refs"), "utf8").catch(() => "")
  return packed.split("\n").some((line) => line.endsWith(` refs/heads/${branch}`))
}
