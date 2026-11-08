import { describe, expect, test } from "bun:test"
import { readFile, realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { UnreachableRepoError, type Trek, loadTrek, trekPath, viewContext } from "../../src"
import { changeOf, makeBranchRepo, saveTrekOf } from "../support/branch"
import { makeCacheDir } from "../support/remote"
import { rejection } from "../support/rejection"
import { commit } from "../support/repo"

// A repo on a feature branch, and the one-step trek of its change, saved there.
async function repoWithTrek(): Promise<{ dir: string; trek: Trek; cacheDir: string }> {
  const dir = await makeBranchRepo()
  await saveTrekOf(dir, await changeOf(dir), "refunds")

  return { dir, trek: await loadTrek(trekPath(dir, "refunds")), cacheDir: await makeCacheDir() }
}

describe("viewContext", () => {
  test("uses the user's own checkout while it's at the trek's revision", async () => {
    const { dir, trek, cacheDir } = await repoWithTrek()
    const name = trek.repos[0]?.name ?? ""

    const context = await viewContext(dir, trek, { cacheDir })

    expect(context.roots.get(name)).toBe(await realpath(dir))
    expect(context.stale).toEqual(new Set())
  })

  test("gives the lines the trek's range touches in each file it visits", async () => {
    const { dir, trek, cacheDir } = await repoWithTrek()
    const name = trek.repos[0]?.name ?? ""

    const context = await viewContext(dir, trek, { cacheDir })

    expect(context.changedLines.get(name)?.get("app.ts")).toEqual(new Map([[1, "added"]]))
  })

  test("checks out the trek's revision once the branch has moved on, and marks moved steps stale", async () => {
    const { dir, trek, cacheDir } = await repoWithTrek()
    const name = trek.repos[0]?.name ?? ""
    await commit(dir, "app.ts", "const total = 300\n")

    const context = await viewContext(dir, trek, { cacheDir, change: await changeOf(dir) })
    const root = context.roots.get(name) ?? ""

    expect(root.startsWith(cacheDir)).toBe(true)
    expect(await readFile(join(root, "app.ts"), "utf8")).toBe("const total = 250\n")
    expect(context.stale).toEqual(new Set(["s1"]))
  })

  test("opens the user's own file after the branch moves on, while it's the trek's version", async () => {
    const { dir, trek, cacheDir } = await repoWithTrek()
    const name = trek.repos[0]?.name ?? ""
    await commit(dir, "other.ts", "export {}\n")

    const context = await viewContext(dir, trek, { cacheDir })

    expect(context.own.get(name)).toEqual({ root: await realpath(dir), files: new Set(["app.ts"]) })
    // every file the trek visits is the user's own, so no copy of the trek's is checked out
    expect(context.roots.get(name)).toBe(await realpath(dir))
  })

  test("shows the trek's copy of a file the user has edited since", async () => {
    const { dir, trek, cacheDir } = await repoWithTrek()
    const name = trek.repos[0]?.name ?? ""
    await writeFile(join(dir, "app.ts"), "const total = 999\n")

    const context = await viewContext(dir, trek, { cacheDir })

    expect(context.own.get(name)).toEqual({ root: await realpath(dir), files: new Set() })
    expect(context.roots.get(name)?.startsWith(cacheDir)).toBe(true)
  })

  test("names a repo that isn't where the trek says", async () => {
    const { dir, trek, cacheDir } = await repoWithTrek()
    const moved = { ...trek, repos: trek.repos.map((repo) => ({ ...repo, source: "../gone" })) }

    const error = await rejection(viewContext(dir, moved, { cacheDir }))

    expect(error).toBeInstanceOf(UnreachableRepoError)
    expect(String(error)).toContain("../gone")
  })

  test("names a repo that lacks the trek's commit", async () => {
    const { dir, trek, cacheDir } = await repoWithTrek()
    const missing = "0".repeat(40)
    const rewritten = { ...trek, repos: trek.repos.map((repo) => ({ ...repo, revision: missing })) }

    const error = await rejection(viewContext(dir, rewritten, { cacheDir }))

    expect(String(error)).toContain(`no commit ${missing}`)
  })
})
