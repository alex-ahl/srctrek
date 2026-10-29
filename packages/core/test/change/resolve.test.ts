import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { basename, join, relative } from "node:path"
import {
  type ChangeArguments,
  type PullRequest,
  parsePullRequestUrl,
  readFileAt,
  parseRange,
  resolveChange,
  runGit,
  withRouteRepo,
} from "../../src"
import { commit, makeRepo } from "../support/repo"
import { rejection } from "../support/rejection"
import { makeCacheDir, makeRemote } from "../support/remote"
import { tempDir } from "../support/temp"

async function writeReposList(repo: string, text: string): Promise<void> {
  await mkdir(join(repo, ".codetrail"))
  await writeFile(join(repo, ".codetrail", "repos"), text)
}

// The current repo, on a feature branch with one commit since it left main.
async function makeFeatureRepo(): Promise<{ dir: string; head: string }> {
  const dir = await makeRepo()
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  const head = await commit(dir, "app.ts", "feature\n")

  return { dir, head }
}

// Pull request 1 of a host whose clone URL is `cloneUrl`: the test remote's refs/pull/1/head.
function pullRequestAt(cloneUrl: string): PullRequest {
  const pr = parsePullRequestUrl("https://host.test/acme/pay/pull/1")
  if (pr === undefined) {
    throw new Error("not a pull request URL")
  }

  return { ...pr, cloneUrl }
}

const currentBranch: ChangeArguments["changes"] = [
  { kind: "range", repo: { source: "." }, range: parseRange("") },
]

describe("resolveChange", () => {
  test("resolves the change, then the repos given, then the listed ones, each once", async () => {
    const current = await makeFeatureRepo()
    const given = await makeRepo()
    const listed = await makeRepo()
    const fromCurrent = (dir: string) => relative(current.dir, dir)
    await writeReposList(current.dir, `${fromCurrent(listed)}\n${fromCurrent(given)}\n.\n`)

    const args = {
      changes: currentBranch,
      unchanged: [{ source: fromCurrent(given) }],
      uncommitted: false,
    }
    const { repos } = await resolveChange(current.dir, args, await makeCacheDir())

    expect(repos.map((repo) => repo.name)).toEqual([
      basename(current.dir),
      basename(given),
      basename(listed),
    ])
    expect(repos[0]).toMatchObject({ revision: current.head, range: { headCommit: current.head } })
    expect(repos[1]?.range).toBeUndefined()
  })

  test("with --uncommitted, ends the current repo's range at a snapshot of its work", async () => {
    const current = await makeFeatureRepo()
    await writeFile(join(current.dir, "app.ts"), "not committed\n")

    const args = { changes: currentBranch, unchanged: [], uncommitted: true }
    const { repos } = await resolveChange(current.dir, args, await makeCacheDir())
    const head = repos[0]?.range?.headCommit ?? ""

    expect(head).not.toBe(current.head)
    expect(await readFileAt(current.dir, head, "app.ts")).toBe("not committed\n")
    expect(repos[0]?.revision).toBe(head)
  })

  test("says when --uncommitted has no range at HEAD in a local repo to apply to", async () => {
    const remote = await makeRemote()
    const pr = { kind: "pull-request" as const, pr: pullRequestAt(remote.url) }
    const args = { changes: [pr], unchanged: [], uncommitted: true }

    expect(await rejection(resolveChange(remote.dir, args, await makeCacheDir()))).toHaveProperty(
      "message",
      "--uncommitted needs a range ending at HEAD in a local repo",
    )
  })

  test("with --code, reads local repos at what's checked out, and keeps the trigger", async () => {
    const current = await makeFeatureRepo()
    const code = { trigger: "a refund request" }
    const args = { changes: [], unchanged: [{ source: "." }], uncommitted: false, code }

    const resolved = await resolveChange(current.dir, args, await makeCacheDir())
    expect(resolved.code).toEqual(code)
    expect(resolved.repos[0]).toMatchObject({ revision: current.head })
    expect(resolved.repos[0]?.range).toBeUndefined()

    await writeFile(join(current.dir, "app.ts"), "not committed\n")
    const withWork = await resolveChange(
      current.dir,
      { ...args, uncommitted: true },
      await makeCacheDir(),
    )
    expect(await readFileAt(current.dir, withWork.repos[0]?.revision ?? "", "app.ts")).toBe(
      "not committed\n",
    )
  })

  test("says when two repos share a name", async () => {
    const current = await makeFeatureRepo()
    const [one, two] = [await makeRepo(), await makeRepo()]
    const list = `api = ${relative(current.dir, one)}\napi = ${relative(current.dir, two)}\n`
    await writeReposList(current.dir, list)

    const args = { changes: currentBranch, unchanged: [], uncommitted: false }
    const error = await rejection(resolveChange(current.dir, args, await makeCacheDir()))

    expect(error).toHaveProperty("message", expect.stringContaining("two repos named api"))
  })

  test("resolves a pull request from outside any repo", async () => {
    const remote = await makeRemote()
    const outside = await tempDir("outside-")
    const pr = { kind: "pull-request" as const, pr: pullRequestAt(remote.url) }
    const args = { changes: [pr], unchanged: [], uncommitted: false }
    const { repos } = await resolveChange(outside, args, await makeCacheDir())

    expect(repos).toHaveLength(1)
    expect(repos[0]).toMatchObject({ name: "pay", revision: remote.prHead })
  })
})

describe("withRouteRepo", () => {
  // The current repo, its change, and a repo beside it with a commit on main and one on wip.
  async function withNeighbour() {
    const { dir } = await makeFeatureRepo()
    const other = await makeRepo()
    const main = await runGit(other, ["rev-parse", "main"])
    await runGit(other, ["switch", "--quiet", "-c", "wip"])
    const wip = await commit(other, "draft.ts", "not merged\n")
    await runGit(other, ["switch", "--quiet", "main"])
    const args: ChangeArguments = { changes: [], unchanged: [{ source: "." }], uncommitted: false }
    const change = await resolveChange(dir, args, await makeCacheDir())

    return { dir, change, source: relative(dir, other), main, wip, other }
  }

  test("reads a repo on the work's branch as part of the change", async () => {
    const { dir, change, source, main, wip } = await withNeighbour()

    const added = await withRouteRepo(dir, change, { name: "pay", source }, ["wip"])

    expect(added.readAt).toEqual({ kind: "work-branch", branch: "wip" })
    expect(added.change.repos[1]).toMatchObject({
      name: "pay",
      revision: wip,
      range: { baseCommit: main, headCommit: wip },
    })
  })

  test("reads a repo without the work's branch at its default branch, saying why", async () => {
    const { dir, change, source, main } = await withNeighbour()

    const added = await withRouteRepo(dir, change, { name: "pay", source }, ["feature"])
    const unnamed = await withRouteRepo(dir, change, { name: "pay", source }, [])

    expect(added.readAt).toEqual({ kind: "default", why: `${source} has no branch feature` })
    expect(added.change.repos[1]?.revision).toBe(main)
    expect(added.change.repos[1]?.range).toBeUndefined()
    expect(unnamed.readAt).toEqual({
      kind: "default",
      why: "the change isn't on a branch to match",
    })
  })

  test("reads a pinned repo at its pin", async () => {
    const { dir, change, source, wip } = await withNeighbour()

    const added = await withRouteRepo(dir, change, { name: "pay", source, revision: "wip" }, [])

    expect(added.readAt).toEqual({ kind: "pinned", revision: "wip" })
    expect(added.change.repos[1]?.revision).toBe(wip)
  })

  test("says when the work's branch is behind the branch it tracks, as of the last fetch", async () => {
    const { dir, change } = await withNeighbour()
    const remote = await makeRepo()
    await runGit(remote, ["switch", "--quiet", "-c", "feature"])
    await commit(remote, "pay.ts", "v1\n")
    const clone = join(await tempDir("clone-"), "pay")
    await runGit(dir, ["clone", "--quiet", remote, clone])
    await commit(remote, "pay.ts", "v2\n")
    await commit(remote, "pay.ts", "v3\n")
    await runGit(clone, ["fetch", "--quiet"])

    const added = await withRouteRepo(dir, change, { source: relative(dir, clone) }, ["feature"])

    expect(added.readAt).toEqual({
      kind: "work-branch",
      branch: "feature",
      behind: { commits: 2, upstream: "origin/feature" },
    })
  })

  test("refuses a repo already on the route, a name already taken, and a path with no repo", async () => {
    const { dir, change, source } = await withNeighbour()
    const taken = basename(dir)

    expect(await rejection(withRouteRepo(dir, change, { source: "." }, []))).toHaveProperty(
      "message",
      ". is already on the route",
    )
    const clash = await rejection(withRouteRepo(dir, change, { name: taken, source }, []))
    expect(String(clash)).toContain(`two repos named ${taken}`)
    expect(
      await rejection(withRouteRepo(dir, change, { source: "../nowhere" }, [])),
    ).toHaveProperty("message", "no repo at ../nowhere")
  })
})

describe("a project folder that keeps a bare repo beside its worktrees", () => {
  test("is read as a repo, named after the folder, at its default branch", async () => {
    const { dir } = await makeFeatureRepo()
    const source = await makeRepo()
    const head = await commit(source, "charge.ts", "charged\n")
    const parent = await tempDir("project-")
    const project = join(parent, "payments")
    await mkdir(project)
    await runGit(project, ["clone", "--quiet", "--bare", source, ".bare"])
    await writeFile(join(project, ".git"), "gitdir: ./.bare\n")
    await runGit(project, ["worktree", "add", "--quiet", "--detach", "development"])

    const args: ChangeArguments = {
      changes: [],
      unchanged: [{ source: relative(dir, project) }],
      uncommitted: false,
    }
    const change = await resolveChange(dir, args, await makeCacheDir())
    const payments = change.repos.find((repo) => repo.name === "payments")

    expect(payments?.revision).toBe(head)
    expect(await readFileAt(payments?.dir ?? "", head, "charge.ts")).toBe("charged\n")
  })
})
