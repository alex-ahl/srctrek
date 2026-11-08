import { copyFile, mkdtemp, rm, stat, utimes } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathExists } from "../files"
import { runGit } from "./run"

// Snapshots aren't the user's commits, and a machine may have no git identity configured.
const SNAPSHOT_IDENTITY = {
  GIT_AUTHOR_NAME: "srctrek",
  GIT_AUTHOR_EMAIL: "srctrek@localhost",
  GIT_COMMITTER_NAME: "srctrek",
  GIT_COMMITTER_EMAIL: "srctrek@localhost",
}

// The temporary index starts as a copy of the user's: it carries git's cached file details, so
// adding the working tree re-reads only files that changed. The copy keeps the original's
// times: git rechecks files changed as recently as its index, and a newer copy would make it
// trust an edit of the same size made in that same second. Without an index, start from HEAD.
async function startIndex(dir: string, index: string): Promise<void> {
  const own = resolve(dir, await runGit(dir, ["rev-parse", "--git-path", "index"]))
  if (await pathExists(own)) {
    const { atime, mtime } = await stat(own)
    await copyFile(own, index)
    await utimes(index, atime, mtime)
    return
  }

  await runGit(dir, ["read-tree", "HEAD"], { env: { GIT_INDEX_FILE: index } })
}

// The working tree as a tree object: HEAD's files, then every edit, staged or not, and every
// new file git doesn't ignore. A temporary index does the work, so the user's stays as it is.
// .srctrek stays as HEAD has it: saving a tour is never part of the change it describes.
async function workingTree(dir: string): Promise<string> {
  const scratch = await mkdtemp(join(tmpdir(), "srctrek-index-"))
  const index = join(scratch, "index")
  const env = { GIT_INDEX_FILE: index }

  try {
    await startIndex(dir, index)
    await runGit(dir, ["add", "--all"], { env })
    // reset rather than an excluding pathspec, which git rejects when .srctrek is ignored
    await runGit(dir, ["reset", "--quiet", "HEAD", "--", ".srctrek"], { env })

    return await runGit(dir, ["write-tree"], { env })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

/**
 * The working tree committed on top of HEAD, without touching the branch, the index, or any
 * file; HEAD itself when nothing is uncommitted. A ref under refs/srctrek keeps the snapshot
 * from git's garbage collection. The same work always gives the same commit, so a tour of it
 * is found again.
 */
export async function snapshotWorkingTree(dir: string): Promise<string> {
  const tree = await workingTree(dir)
  const headTree = await runGit(dir, ["rev-parse", "HEAD^{tree}"])
  if (tree === headTree) {
    return runGit(dir, ["rev-parse", "HEAD"])
  }

  // A commit's id covers its dates; HEAD's date instead of now makes the id depend on the
  // work alone.
  const headDate = await runGit(dir, ["show", "--no-patch", "--format=%cI", "HEAD"])
  const env = { ...SNAPSHOT_IDENTITY, GIT_AUTHOR_DATE: headDate, GIT_COMMITTER_DATE: headDate }

  const message = "srctrek: snapshot of uncommitted changes"
  const args = ["commit-tree", tree, "-p", "HEAD", "-m", message]
  const commit = await runGit(dir, args, { env })
  await runGit(dir, ["update-ref", `refs/srctrek/snapshots/${commit}`, commit])

  return commit
}
