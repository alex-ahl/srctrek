import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, relative } from "node:path"
import {
  type ChangeArguments,
  parsePullRequestUrl,
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

    const args = { changes: currentBranch, unchanged: [{ source: fromCurrent(given) }] }
    const { repos } = await resolveChange(current.dir, args, await makeCacheDir())

    expect(repos.map((repo) => repo.name)).toEqual([
      basename(current.dir),
      basename(given),
      basename(listed),
    ])
    expect(repos[0]).toMatchObject({ revision: current.head, range: { headCommit: current.head } })
    expect(repos[1]?.range).toBeUndefined()
  })

  test("says when two repos share a name", async () => {
    const current = await makeFeatureRepo()
    const [one, two] = [await makeRepo(), await makeRepo()]
    const list = `api = ${relative(current.dir, one)}\napi = ${relative(current.dir, two)}\n`
    await writeReposList(current.dir, list)

    const args = { changes: currentBranch, unchanged: [] }
    const error = await rejection(resolveChange(current.dir, args, await makeCacheDir()))

    expect(error).toHaveProperty("message", expect.stringContaining("two repos named api"))
  })

  test("resolves a pull request from outside any repo", async () => {
    const remote = await makeRemote()
    const pr = parsePullRequestUrl("https://host.test/acme/pay/pull/1")
    if (pr === undefined) {
      throw new Error("not a pull request URL")
    }

    const outside = await mkdtemp(join(tmpdir(), "codetrail-outside-"))
    const args = {
      changes: [{ kind: "pull-request" as const, pr: { ...pr, cloneUrl: remote.url } }],
      unchanged: [],
    }
    const { repos } = await resolveChange(outside, args, await makeCacheDir())

    expect(repos).toHaveLength(1)
    expect(repos[0]).toMatchObject({ name: "pay", revision: remote.prHead })
  })
})
