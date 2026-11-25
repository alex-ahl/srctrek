import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { pathExists } from "../files"
import { isBare } from "../git/base"
import { NO_PROMPT, runGit } from "../git/run"
import { defaultCacheDir } from "./cache"
import { folderName } from "./entry"

// The user's own checkout serves when it's at `commit` with no edits to tracked files.
// Untracked files don't move any line the trek cites.
async function isCleanAt(dir: string, commit: string): Promise<boolean> {
  if (await isBare(dir)) {
    return false
  }

  const head = await runGit(dir, ["rev-parse", "HEAD"])
  const edits = await runGit(dir, ["status", "--porcelain", "--untracked-files=no"])

  return head === commit && edits === ""
}

// <cache>/worktrees/<repo>-<id>/<commit>: the id, from where the repo's git data lives, keeps
// two repos with the same folder name apart.
async function worktreePath(cacheDir: string, dir: string, commit: string): Promise<string> {
  const gitDir = resolve(dir, await runGit(dir, ["rev-parse", "--git-common-dir"]))
  const id = createHash("sha1").update(gitDir).digest("hex").slice(0, 8)

  return join(cacheDir, "worktrees", `${folderName(dir)}-${id}`, commit)
}

// Added beside its final place and moved when complete, so an interrupted checkout is never
// mistaken for a finished one. Pruning first forgets worktrees whose folders were deleted, so
// their paths can be used again.
async function addWorktree(dir: string, path: string, commit: string): Promise<void> {
  const partial = `${path}.partial-${process.pid}`
  await mkdir(dirname(path), { recursive: true })
  await runGit(dir, ["worktree", "prune"])

  const args = ["worktree", "add", "--quiet", "--detach", partial, commit]
  await runGit(dir, args, NO_PROMPT)

  await runGit(dir, ["worktree", "move", partial, path])
}

/**
 * The folder the editor opens for a repo at `commit`: the user's own checkout when it's
 * already there unedited, else a cached worktree detached at `commit`, made on first use.
 */
export async function editorCheckout(
  dir: string,
  commit: string,
  cacheDir = defaultCacheDir(),
): Promise<string> {
  if (await isCleanAt(dir, commit)) {
    return runGit(dir, ["rev-parse", "--show-toplevel"])
  }

  const path = await worktreePath(cacheDir, dir, commit)
  if (!(await pathExists(path))) {
    await addWorktree(dir, path, commit)
  }

  return path
}
