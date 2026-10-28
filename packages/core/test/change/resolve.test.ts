import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, relative } from "node:path"
import {
  type ChangeArguments,
  type PullRequest,
  parsePullRequestUrl,
  readFileAt,
  parseRange,
  resolveChange,
  runGit,
} from "../../src"
import { commit, makeRepo } from "../support/repo"
import { rejection } from "../support/rejection"
import { makeCacheDir, makeRemote } from "../support/remote"

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
    const outside = await mkdtemp(join(tmpdir(), "codetrail-outside-"))
    const pr = { kind: "pull-request" as const, pr: pullRequestAt(remote.url) }
    const args = { changes: [pr], unchanged: [], uncommitted: false }
    const { repos } = await resolveChange(outside, args, await makeCacheDir())

    expect(repos).toHaveLength(1)
    expect(repos[0]).toMatchObject({ name: "pay", revision: remote.prHead })
  })
})
