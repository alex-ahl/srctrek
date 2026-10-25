import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { readReposList, resolveUnchangedRepo, runGit } from "../../src"
import { commit, makeRepo } from "../support/repo"
import { rejection } from "../support/rejection"

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

  test("says when the path isn't a git repo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codetrail-plain-"))
    expect(await rejection(resolveUnchangedRepo(dir, { source: "." }))).toHaveProperty(
      "message",
      "not a git repo: .",
    )
  })

  test("says remote repos aren't supported yet", async () => {
    const remote = { source: "git@host:org/auth.git" }
    expect(await rejection(resolveUnchangedRepo("/", remote))).toHaveProperty(
      "message",
      "remote repos aren't supported yet: git@host:org/auth.git",
    )
  })
})

describe("readReposList", () => {
  test("reads .codetrail/repos, or nothing when there is none", async () => {
    const root = await mkdtemp(join(tmpdir(), "codetrail-list-"))
    expect(await readReposList(root)).toEqual([])

    await mkdir(join(root, ".codetrail"))
    await writeFile(join(root, ".codetrail", "repos"), "../gateway\n")
    expect(await readReposList(root)).toEqual([{ source: "../gateway" }])
  })
})
