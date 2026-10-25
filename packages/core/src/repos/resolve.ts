import { basename, resolve } from "node:path"
import { detectBase } from "../git/base"
import { GitError, runGit } from "../git/run"
import { type RepoEntry, isRemote } from "./entry"

/** The tour's repo shape for a repo on the route without changes: no range. */
export type UnchangedRepo = { name: string; source: string; revision: string }

async function repoTopLevel(dir: string, source: string): Promise<string> {
  try {
    return await runGit(dir, ["rev-parse", "--show-toplevel"])
  } catch (error) {
    if (error instanceof GitError) throw new Error(`not a git repo: ${source}`, { cause: error })
    throw error
  }
}

/**
 * Resolves a local entry, its path relative to `baseDir` (the folder the entry was written
 * for), to the commit the tour reads. Without a revision, the repo's base branch is used;
 * without a name, the repo is named after its folder. The source is kept as written, so a
 * tour that records it stays valid on other machines.
 */
export async function resolveUnchangedRepo(
  baseDir: string,
  entry: RepoEntry,
): Promise<UnchangedRepo> {
  if (isRemote(entry.source)) {
    throw new Error(`remote repos aren't supported yet: ${entry.source}`)
  }
  const top = await repoTopLevel(resolve(baseDir, entry.source), entry.source)
  const revision = entry.revision ?? (await detectBase(top))
  const commit = await runGit(top, ["rev-parse", "--verify", `${revision}^{commit}`])
  return { name: entry.name ?? basename(top), source: entry.source, revision: commit }
}
