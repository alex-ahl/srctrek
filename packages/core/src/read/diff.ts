import type { ResolvedRepo } from "../change/resolve"
import { type FileChange, changedFiles } from "../git/diff"
import type { ResolvedRange } from "../git/range"
import { runGit } from "../git/run"
import { describeRepo } from "./repo"

function rangeOf(repo: ResolvedRepo): ResolvedRange {
  if (repo.range === undefined) {
    throw new Error(`${describeRepo(repo)} has no changes: it's on the route unchanged`)
  }

  return repo.range
}

/** The files the repo's change touches. */
export async function changeFiles(repo: ResolvedRepo): Promise<FileChange[]> {
  const { baseCommit, headCommit } = rangeOf(repo)

  return changedFiles(repo.dir, baseCommit, headCommit)
}

/** One file's patch in the repo's change; empty when the change leaves it alone. */
export async function changePatch(repo: ResolvedRepo, path: string): Promise<string> {
  const { baseCommit, headCommit } = rangeOf(repo)
  const args = ["diff", "--find-renames", baseCommit, headCommit, "--", path]

  return runGit(repo.dir, args, { trim: false })
}
