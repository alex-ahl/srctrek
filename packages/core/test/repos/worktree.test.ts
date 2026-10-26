import { describe, expect, test } from "bun:test"
import { readFile, realpath, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { cachedRepo, editorCheckout, fetchRefs, runGit } from "../../src"
import { commit, makeRepo } from "../support/repo"
import { makeCacheDir, makeRemote } from "../support/remote"

describe("editorCheckout", () => {
  test("uses the user's checkout when it's at the commit, untracked files aside", async () => {
    const repo = await makeRepo()
    const head = await commit(repo, "app.ts", "v1\n")
    await writeFile(join(repo, "notes.txt"), "untracked\n")

    expect(await editorCheckout(repo, head, await makeCacheDir())).toBe(await realpath(repo))
  })

  test("checks out a worktree when the user's checkout is elsewhere", async () => {
    const repo = await makeRepo()
    const first = await commit(repo, "app.ts", "v1\n")
    await commit(repo, "app.ts", "v2\n")

    const path = await editorCheckout(repo, first, await makeCacheDir())

    expect(await runGit(path, ["rev-parse", "HEAD"])).toBe(first)
    expect(await readFile(join(path, "app.ts"), "utf8")).toBe("v1\n")
  })

  test("checks out a worktree when the user has edited a tracked file", async () => {
    const repo = await makeRepo()
    const head = await commit(repo, "app.ts", "v1\n")
    await writeFile(join(repo, "app.ts"), "edited\n")

    const path = await editorCheckout(repo, head, await makeCacheDir())

    expect(await readFile(join(path, "app.ts"), "utf8")).toBe("v1\n")
  })

  test("reuses a worktree, and recreates one whose folder was deleted", async () => {
    const repo = await makeRepo()
    const first = await commit(repo, "app.ts", "v1\n")
    await commit(repo, "app.ts", "v2\n")
    const cacheDir = await makeCacheDir()

    const path = await editorCheckout(repo, first, cacheDir)
    expect(await editorCheckout(repo, first, cacheDir)).toBe(path)

    await rm(path, { recursive: true })
    expect(await editorCheckout(repo, first, cacheDir)).toBe(path)
    expect(await readFile(join(path, "app.ts"), "utf8")).toBe("v1\n")
  })

  test("checks out a pull request from a cached clone", async () => {
    const remote = await makeRemote()
    const cacheDir = await makeCacheDir()
    const dir = await cachedRepo(cacheDir, remote.url)
    await fetchRefs(dir, ["refs/pull/1/head"])

    const path = await editorCheckout(dir, remote.prHead, cacheDir)

    expect(await readFile(join(path, "app.ts"), "utf8")).toBe("change\n")
  })
})
