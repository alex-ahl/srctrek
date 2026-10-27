import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runGit } from "./run"

// Snapshots aren't the user's commits, and a machine may have no git identity configured.
const SNAPSHOT_IDENTITY = {
  GIT_AUTHOR_NAME: "codetrail",
  GIT_AUTHOR_EMAIL: "codetrail@localhost",
  GIT_COMMITTER_NAME: "codetrail",
  GIT_COMMITTER_EMAIL: "codetrail@localhost",
}

// The working tree as a tree object: HEAD's files, then every edit, staged or not, and every
// new file git doesn't ignore. A temporary index does the work, so the user's stays as it is.
async function workingTree(dir: string): Promise<string> {
  const scratch = await mkdtemp(join(tmpdir(), "codetrail-index-"))
  const env = { GIT_INDEX_FILE: join(scratch, "index") }

  try {
    await runGit(dir, ["read-tree", "HEAD"], { env })
    await runGit(dir, ["add", "--all"], { env })

    return await runGit(dir, ["write-tree"], { env })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

/**
 * The working tree committed on top of HEAD, without touching the branch, the index, or any
 * file; HEAD itself when nothing is uncommitted. A ref under refs/codetrail keeps the snapshot
 * from git's garbage collection.
 */
export async function snapshotWorkingTree(dir: string): Promise<string> {
  const tree = await workingTree(dir)
  const headTree = await runGit(dir, ["rev-parse", "HEAD^{tree}"])
  if (tree === headTree) {
    return runGit(dir, ["rev-parse", "HEAD"])
  }

  const message = "codetrail: snapshot of uncommitted changes"
  const args = ["commit-tree", tree, "-p", "HEAD", "-m", message]
  const commit = await runGit(dir, args, { env: SNAPSHOT_IDENTITY })
  await runGit(dir, ["update-ref", `refs/codetrail/snapshots/${commit}`, commit])

  return commit
}
