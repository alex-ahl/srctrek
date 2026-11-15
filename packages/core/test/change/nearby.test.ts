import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type ChangeArguments,
  nearbyCheckouts,
  nearbyRepos,
  parseRange,
  resolveChange,
  runGit,
} from "../../src"
import { commit } from "../support/repo"
import { makeCacheDir } from "../support/remote"
import { tempDir } from "../support/temp"

async function repoIn(parent: string, name: string): Promise<string> {
  const dir = join(parent, name)
  await mkdir(dir)
  await runGit(dir, ["init", "--quiet", "--initial-branch=main"])
  await commit(dir, "README.md", `${name}\n`)
  return dir
}

async function onBranch(dir: string, branch: string): Promise<void> {
  await runGit(dir, ["switch", "--quiet", "-c", branch])
  await commit(dir, "work.ts", `${branch}\n`)
}

async function changeOf(dir: string, args: Partial<ChangeArguments>) {
  const all = { changes: [], unchanged: [], uncommitted: false, ...args }
  return resolveChange(dir, all, await makeCacheDir())
}

describe("nearbyRepos", () => {
  test("names the other repos beside the current one, leaving out opened ones, worktrees of the same repo, and plain folders", async () => {
    const parent = await tempDir("nearby-")
    const web = await repoIn(parent, "web")
    await repoIn(parent, "api")
    await repoIn(parent, "worker")
    await repoIn(parent, "docs")
    await mkdir(join(parent, "notes"))
    await runGit(web, ["worktree", "add", "--quiet", "--detach", join(parent, "web-review")])

    const change = await changeOf(web, {
      unchanged: [{ source: "." }, { source: "../docs" }],
      code: { trigger: undefined },
    })

    expect(await nearbyRepos(web, change)).toEqual({
      repos: [{ path: "../api" }, { path: "../worker" }],
      leftOut: 0,
    })
  })

  test("says which have a branch the work is on: the range's head, or HEAD's branch, never the base", async () => {
    const parent = await tempDir("nearby-")
    const web = await repoIn(parent, "web")
    await onBranch(web, "feature")
    await onBranch(await repoIn(parent, "api"), "feature")
    await onBranch(await repoIn(parent, "worker"), "other")

    const named = await changeOf(web, {
      changes: [{ kind: "range", repo: { source: "." }, range: parseRange("main...feature") }],
    })
    const uncommitted = (range: string) =>
      changeOf(web, {
        changes: [{ kind: "range", repo: { source: "." }, range: parseRange(range) }],
        uncommitted: true,
      })
    const nothingYet = await uncommitted("")
    await writeFile(join(web, "work.ts"), "edited\n")
    const edited = await uncommitted("")

    const expected = {
      repos: [{ path: "../api", branch: "feature" }, { path: "../worker" }],
      leftOut: 0,
    }
    expect(await nearbyRepos(web, named)).toEqual(expected)
    expect(await nearbyRepos(web, nothingYet)).toEqual(expected)
    expect(await nearbyRepos(web, edited)).toEqual(expected)
  })

  test("says when a repo has the work's branch only as a remote-tracking one", async () => {
    const parent = await tempDir("nearby-")
    const web = await repoIn(parent, "web")
    await onBranch(web, "feature")
    const host = await repoIn(await tempDir("host-"), "api")
    await onBranch(host, "feature")
    await runGit(host, ["switch", "--quiet", "main"])
    await runGit(parent, ["clone", "--quiet", host, "api"])
    const change = await changeOf(web, {
      changes: [{ kind: "range", repo: { source: "." }, range: parseRange("main...feature") }],
    })

    const { repos } = await nearbyRepos(web, change)

    expect(repos).toEqual([{ path: "../api", branch: "origin/feature" }])
  })

  test("lists repos on the work's branch first", async () => {
    const parent = await tempDir("nearby-")
    const web = await repoIn(parent, "web")
    await onBranch(web, "feature")
    await repoIn(parent, "api")
    await onBranch(await repoIn(parent, "worker"), "feature")
    const change = await changeOf(web, {
      changes: [{ kind: "range", repo: { source: "." }, range: parseRange("main...feature") }],
    })

    const { repos } = await nearbyRepos(web, change)

    expect(repos.map(({ path }) => path)).toEqual(["../worker", "../api"])
  })

  test("looks around a project folder that keeps a bare repo beside its worktrees", async () => {
    const parent = await tempDir("nearby-")
    const source = await repoIn(parent, "source")
    const project = join(parent, "web")
    await mkdir(project)
    await runGit(project, ["clone", "--quiet", "--bare", source, ".bare"])
    await writeFile(join(project, ".git"), "gitdir: ./.bare\n")
    await runGit(project, ["worktree", "add", "--quiet", "--detach", "development"])
    await runGit(project, ["worktree", "add", "--quiet", "--detach", "review"])
    await repoIn(parent, "api")

    const development = join(project, "development")
    const change = await changeOf(development, {
      unchanged: [{ source: "." }],
      code: { trigger: undefined },
    })

    const { repos } = await nearbyRepos(development, change)

    expect(repos.map(({ path }) => path)).toEqual(["../../api", "../../source"])
  })
})

describe("nearbyCheckouts", () => {
  test("lists the repos beside this one with the branch each has out and its commits", async () => {
    const parent = await tempDir("nearby-")
    const web = await repoIn(parent, "web")
    await onBranch(await repoIn(parent, "api"), "refunds-api")
    await repoIn(parent, "worker")

    const checkouts = await nearbyCheckouts(web)

    expect(checkouts).toEqual([
      { path: "../api", name: "api", branch: "refunds-api", commits: 1 },
      { path: "../worker", name: "worker", branch: "main", commits: 0 },
    ])
  })
})
