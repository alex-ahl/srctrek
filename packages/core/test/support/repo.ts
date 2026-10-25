import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runGit } from "../../src"

// Commits need an identity; CI machines have none configured.
const IDENTITY = ["-c", "user.name=test", "-c", "user.email=test@example.test"]

/** A new repo on branch `main` with one commit. */
export async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codetrail-git-"))
  await runGit(dir, ["init", "--quiet", "--initial-branch=main"])
  await commit(dir, "README.md", "base\n")
  return dir
}

/** Writes `file` and commits it; returns the new commit. */
export async function commit(dir: string, file: string, content: string): Promise<string> {
  await writeFile(join(dir, file), content)
  await runGit(dir, ["add", file])
  await runGit(dir, [...IDENTITY, "commit", "--quiet", "-m", `change ${file}`])
  return runGit(dir, ["rev-parse", "HEAD"])
}
