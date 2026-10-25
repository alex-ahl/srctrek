import { cp, mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runGit } from "../../src"
import { commitStaged } from "./repo"

const FIXTURES = join(import.meta.dir, "../../../../evals/fixtures")

export type Fixture = {
  // repo name -> its directory, with `main` (the base) and `feature` (the change) branches
  repos: Record<string, string>
  dir: string // the fixture's source folder, where expected.json lives
}

// A fixture repo is stored as base/ plus change.patch: a git repo can't be committed inside
// this one.
async function buildRepo(source: string, target: string): Promise<void> {
  await cp(join(source, "base"), target, { recursive: true })
  await runGit(target, ["init", "--quiet", "--initial-branch=main"])
  await runGit(target, ["add", "--all"])
  await commitStaged(target, "base")

  await runGit(target, ["checkout", "--quiet", "-b", "feature"])
  await runGit(target, ["apply", join(source, "change.patch")])
  await runGit(target, ["add", "--all"])
  await commitStaged(target, "change")
}

/** Builds every repo of evals/fixtures/<name> as a real git repo in a temporary folder. */
export async function buildFixture(name: string): Promise<Fixture> {
  const dir = join(FIXTURES, name)
  const root = await mkdtemp(join(tmpdir(), `codetrail-${name}-`))

  const entries = await readdir(dir, { withFileTypes: true })
  const repoNames = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  await Promise.all(repoNames.map((repo) => buildRepo(join(dir, repo), join(root, repo))))

  return { repos: Object.fromEntries(repoNames.map((repo) => [repo, join(root, repo)])), dir }
}
