import { runGit } from "@srctrek/core"
import { cp, mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const FIXTURES = join(import.meta.dir, "../../../evals/fixtures")

// Commits need an identity; CI machines have none configured.
const IDENTITY = ["-c", "user.name=eval", "-c", "user.email=eval@example.test"]

export type Fixture = Readonly<{
  // repo name -> its directory, with `main` (the base) and `feature` (the change) branches;
  // for a reviewer, `feature` only as origin/feature
  repos: Readonly<Record<string, string>>
  dir: string // the fixture's source folder, where expected.json lives
}>

/** The source folder of fixture `name`, where its expected.json lives. */
export function fixtureDir(name: string): string {
  return join(FIXTURES, name)
}

async function subfolders(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

async function commitAll(dir: string, message: string): Promise<void> {
  await runGit(dir, ["add", "--all"])
  await runGit(dir, [...IDENTITY, "commit", "--quiet", "-m", message])
}

// A fixture repo is stored as base/ plus change.patch: a git repo can't be committed inside
// this one.
async function buildRepo(source: string, target: string): Promise<void> {
  await cp(join(source, "base"), target, { recursive: true })
  await runGit(target, ["init", "--quiet", "--initial-branch=main"])
  await commitAll(target, "base")

  await runGit(target, ["checkout", "--quiet", "-b", "feature"])
  await runGit(target, ["apply", join(source, "change.patch")])
  await commitAll(target, "change")
}

// The repo as a reviewer has it: a clone of its host, so the work is there as origin/feature
// only, and main is the one local branch. The host stays in a folder that isn't a repo itself,
// beside the clones.
async function buildReviewerRepo(source: string, root: string, repo: string): Promise<void> {
  const host = join(root, "hosts", repo)
  await buildRepo(source, host)
  await runGit(host, ["checkout", "--quiet", "main"])
  await runGit(root, ["clone", "--quiet", host, repo])
}

/**
 * Builds every repo of evals/fixtures/<name> as a real git repo in a temporary folder; with
 * `asReviewer`, as clones of stand-in hosts, the work only on their remote-tracking branches.
 */
export async function buildFixture(name: string, { asReviewer = false } = {}): Promise<Fixture> {
  const dir = fixtureDir(name)
  const root = await mkdtemp(join(tmpdir(), `srctrek-${name}-`))

  const repoNames = await subfolders(dir)
  const build = (repo: string) =>
    asReviewer
      ? buildReviewerRepo(join(dir, repo), root, repo)
      : buildRepo(join(dir, repo), join(root, repo))
  await Promise.all(repoNames.map(build))

  return { repos: Object.fromEntries(repoNames.map((repo) => [repo, join(root, repo)])), dir }
}

/**
 * Commits each repo's follow-up, where the fixture has one (`<repo>/followup.patch`): a later
 * commit on the work's branch, which leaves a trek of it stale. The repos it touched, by name.
 */
export async function applyFollowups(fixture: Fixture): Promise<string[]> {
  const touched = await Promise.all(
    Object.entries(fixture.repos).map(async ([repo, dir]) => {
      const patch = join(fixture.dir, repo, "followup.patch")
      if (!(await Bun.file(patch).exists())) {
        return []
      }

      await runGit(dir, ["apply", patch])
      await commitAll(dir, "follow-up")
      return [repo]
    }),
  )

  return touched.flat()
}

/** The fixtures under evals/fixtures, by name. */
export function fixtureNames(): Promise<string[]> {
  return subfolders(FIXTURES)
}
