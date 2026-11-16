import { mkdir, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { runGit } from "@srctrek/core"
import { tempDir } from "./temp"

// Commits need an identity; CI machines have none configured.
const IDENTITY = ["-c", "user.name=test", "-c", "user.email=test@example.test"]

/**
 * A new repo on branch `main` with one commit, alone in its own folder, so nothing beside it
 * looks like a neighbouring repo. Its folder name is unique, as repos are named after it.
 */
export async function makeRepo(): Promise<string> {
  const parent = await tempDir("git-")
  return repoAt(join(parent, basename(parent)))
}

/** A new repo at `dir`, for repos side by side: on branch `main`, its README the one commit. */
export async function repoAt(dir: string, readme = "base\n"): Promise<string> {
  await mkdir(dir)
  await runGit(dir, ["init", "--quiet", "--initial-branch=main"])
  await commit(dir, "README.md", readme)
  return dir
}

/** Commits whatever is staged; returns the new commit. */
export async function commitStaged(dir: string, message: string): Promise<string> {
  await runGit(dir, [...IDENTITY, "commit", "--quiet", "-m", message])
  return runGit(dir, ["rev-parse", "HEAD"])
}

/** Writes `file` and commits it; returns the new commit. */
export async function commit(dir: string, file: string, content: string): Promise<string> {
  await writeFile(join(dir, file), content)
  await runGit(dir, ["add", file])
  return commitStaged(dir, `change ${file}`)
}
