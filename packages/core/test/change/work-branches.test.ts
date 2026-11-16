import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  type ChangeArguments,
  parsePullRequestUrl,
  parseRange,
  resolveChange,
  runGit,
  workBranches,
} from "../../src"
import { commit, makeCacheDir, makeRemote, makeRepo, tempDir } from "@srctrek/testing"

async function changeOf(dir: string, args: Partial<ChangeArguments>) {
  const all = { changes: [], unchanged: [], uncommitted: false, ...args }
  return resolveChange(dir, all, await makeCacheDir())
}

// Pull request 1 on a host whose clone URL is `url`.
function pullRequest(url: string) {
  const pr = parsePullRequestUrl("https://host.test/acme/pay/pull/1")
  if (pr === undefined) {
    throw new Error("not a pull request URL")
  }

  return { kind: "pull-request" as const, pr: { ...pr, cloneUrl: url } }
}

describe("workBranches", () => {
  test("takes a range ending at a remote-tracking branch as the work on that branch", async () => {
    const remote = await makeRepo()
    await runGit(remote, ["switch", "--quiet", "-c", "feature"])
    await commit(remote, "pay.ts", "refund\n")
    await runGit(remote, ["switch", "--quiet", "main"])
    const clone = join(await tempDir("review-"), "web")
    await runGit(remote, ["clone", "--quiet", remote, clone])

    const range = parseRange("origin/main...origin/feature")
    const change = await changeOf(clone, {
      changes: [{ kind: "range", repo: { source: "." }, range }],
    })

    expect(await workBranches(clone, change)).toEqual(["feature"])
  })

  test("takes a pull request's branch from the host: the branch at its head", async () => {
    const remote = await makeRemote()
    const cwd = await makeRepo()

    const fromFork = await changeOf(cwd, { changes: [pullRequest(remote.url)] })
    expect(await workBranches(cwd, fromFork)).toEqual([])

    await runGit(remote.dir, ["branch", "feature", remote.prHead])
    const fromBranch = await changeOf(cwd, { changes: [pullRequest(remote.url)] })
    expect(await workBranches(cwd, fromBranch)).toEqual(["feature"])
  })
})
