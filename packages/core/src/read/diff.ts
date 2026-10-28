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

/** The files a change touches, at most a couple of hundred; `truncated` when there were more. */
export type ChangedFiles = { files: FileChange[]; truncated: boolean }

/** A file's patch, cut after several hundred lines; `cutLines` says how many were left out. */
export type Patch = { patch: string; cutLines: number }

// A change touching more files than this is read a folder at a time.
const FILES_LIMIT = 200
const PATCH_LIMIT = 600

/** The files the repo's change touches. */
export async function changeFiles(repo: ResolvedRepo): Promise<ChangedFiles> {
  const { baseCommit, headCommit } = rangeOf(repo)
  const files = await changedFiles(repo.dir, baseCommit, headCommit)

  return { files: files.slice(0, FILES_LIMIT), truncated: files.length > FILES_LIMIT }
}

/** One file's patch in the repo's change; empty when the change leaves it alone. */
export async function changePatch(repo: ResolvedRepo, path: string): Promise<Patch> {
  const { baseCommit, headCommit } = rangeOf(repo)
  const args = ["diff", "--find-renames", baseCommit, headCommit, "--", path]
  const lines = (await runGit(repo.dir, args, { trim: false })).split("\n")

  const kept = lines.slice(0, PATCH_LIMIT)
  return { patch: kept.join("\n"), cutLines: lines.length - kept.length }
}
