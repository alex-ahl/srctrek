import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { runGit } from "../git/run"
import { TREKS_DIR } from "../treks"

// The checked-out branch and its commit; outside a repo, nothing.
function headOf(root: string): Promise<string> {
  return runGit(root, ["rev-parse", "HEAD", "--symbolic-full-name", "HEAD"]).catch(() => "")
}

// Every file in the treks folder and when it last changed: a trek is rewritten in place, which
// leaves the folder's own time alone.
async function treksOf(root: string): Promise<string> {
  const dir = join(root, TREKS_DIR)
  const files = (await readdir(dir).catch(() => [])).toSorted((a, b) => a.localeCompare(b))
  const times = await Promise.all(
    files.map((file) =>
      stat(join(dir, file)).then(
        (info) => `${file}@${info.mtimeMs}`,
        () => file,
      ),
    ),
  )

  return times.join(",")
}

/**
 * Changes whenever the worktree moves on: a new commit, another branch checked out, or a trek
 * saved, rebuilt, or removed. Cheap enough to take every couple of seconds.
 */
export async function worktreeStamp(root: string): Promise<string> {
  const [head, treks] = await Promise.all([headOf(root), treksOf(root)])
  return `${head}\n${treks}`
}
