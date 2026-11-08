import { describe, expect, test } from "bun:test"
import { mkdir, realpath, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
  cachePath,
  parsePullRequestUrl,
  readReposList,
  resolvePullRequest,
  resolveUnchangedRepo,
  runGit,
} from "../../src"
import { commit, makeRepo } from "../support/repo"
import { rejection } from "../support/rejection"
import { makeCacheDir, makeRemote } from "../support/remote"
import { tempDir } from "../support/temp"

describe("resolveUnchangedRepo", () => {
  test("reads the base branch's commit when no revision is pinned", async () => {
    const repo = await makeRepo()
    const main = await commit(repo, "app.ts", "v1\n")
    await runGit(repo, ["switch", "--quiet", "-c", "feature"])
    await commit(repo, "app.ts", "v2\n")

    expect(await resolveUnchangedRepo(dirname(repo), { source: basename(repo) })).toEqual({
      name: basename(repo),
      source: basename(repo),
      revision: main,
      dir: await realpath(repo), // git reports the real path; tmp is a symlink on macOS
    })
  })

  test("reads a pinned revision as its exact commit", async () => {
    const repo = await makeRepo()
    const first = await commit(repo, "app.ts", "v1\n")
    await runGit(repo, ["tag", "v1"])
    await commit(repo, "app.ts", "v2\n")

    const resolved = await resolveUnchangedRepo(repo, { source: ".", revision: "v1" })
    expect(resolved.revision).toBe(first)
  })

  test("names the repo as the entry does", async () => {
    const repo = await makeRepo()
    const resolved = await resolveUnchangedRepo(repo, { name: "payments", source: "." })
    expect(resolved.name).toBe("payments")
  })

  test("says when the path isn't a git repo", async () => {
    const dir = await tempDir("plain-")
    expect(await rejection(resolveUnchangedRepo(dir, { source: "." }))).toHaveProperty(
      "message",
      "not a git repo: .",
    )
  })

  test("reads a remote repo from its cached clone, at the host's default branch", async () => {
    const remote = await makeRemote()
    await runGit(remote.dir, ["switch", "--quiet", "-c", "develop"])
    const develop = await commit(remote.dir, "app.ts", "develop\n")
    const cacheDir = await makeCacheDir()

    const resolved = await resolveUnchangedRepo("/", { source: remote.url }, cacheDir)
    expect(resolved).toEqual({
      name: basename(remote.dir),
      source: remote.url,
      revision: develop,
      dir: cachePath(cacheDir, remote.url),
    })
  })

  test("reads a remote repo at a pinned tag", async () => {
    const remote = await makeRemote()
    await runGit(remote.dir, ["tag", "v1"])
    await commit(remote.dir, "app.ts", "later\n")

    const entry = { source: remote.url, revision: "v1" }
    const resolved = await resolveUnchangedRepo("/", entry, await makeCacheDir())
    expect(resolved.revision).toBe(remote.main)
  })
})

describe("resolvePullRequest", () => {
  test("ranges from where the pull request branched off main to its head", async () => {
    const remote = await makeRemote()
    await commit(remote.dir, "app.ts", "main moved on\n")
    const pr = parsePullRequestUrl("https://host.test/acme/pay/pull/1")
    if (pr === undefined) {
      throw new Error("not a pull request URL")
    }

    const cacheDir = await makeCacheDir()
    const change = await resolvePullRequest({ ...pr, cloneUrl: remote.url }, cacheDir)

    expect(change.dir).toBe(cachePath(cacheDir, remote.url))
    expect(change.range).toMatchObject({ baseCommit: remote.main, headCommit: remote.prHead })
  })
})

describe("readReposList", () => {
  test("reads .srctrek/repos, or nothing when there is none", async () => {
    const root = await tempDir("list-")
    expect(await readReposList(root)).toEqual([])

    await mkdir(join(root, ".srctrek"))
    await writeFile(join(root, ".srctrek", "repos"), "../gateway\n")
    expect(await readReposList(root)).toEqual([{ source: "../gateway" }])
  })
})
