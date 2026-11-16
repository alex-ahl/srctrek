import { readdir, stat } from "node:fs/promises"
import { join, resolve } from "node:path"
import { runGit } from "../git/run"
import { TREKS_DIR } from "../treks/store"
import type { RepoPick } from "./choices"

// The checked-out branch and the commit `ref` is at; outside a repo, nothing.
function headOf(root: string, ref = "HEAD"): Promise<string> {
  return runGit(root, ["rev-parse", ref, "--symbolic-full-name", "HEAD"]).catch(() => "")
}

// A repo ticked to go along is read on its chosen branch when it has one, so a commit there
// counts even while another branch is checked out.
function pickedHead(root: string, repo: RepoPick): Promise<string> {
  return headOf(resolve(root, repo.path), repo.branch)
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
 * saved, rebuilt, or removed; and on a commit or a branch switched in any repo ticked to go along.
 * Cheap enough to take every couple of seconds.
 */
export async function worktreeStamp(
  root: string,
  repos: readonly RepoPick[] = [],
): Promise<string> {
  const [head, treks, ...picked] = await Promise.all([
    headOf(root),
    treksOf(root),
    ...repos.map((repo) => pickedHead(root, repo)),
  ])
  return [head, treks, ...picked].join("\n")
}
