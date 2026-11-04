import { describe, expect, test } from "bun:test"
import { readFile, realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { UnreachableRepoError, type Tour, loadTour, tourPath, viewContext } from "../../src"
import { changeOf, makeBranchRepo, saveTourOf } from "../support/branch"
import { makeCacheDir } from "../support/remote"
import { rejection } from "../support/rejection"
import { commit } from "../support/repo"

// A repo on a feature branch, and the one-step tour of its change, saved there.
async function repoWithTour(): Promise<{ dir: string; tour: Tour; cacheDir: string }> {
  const dir = await makeBranchRepo()
  await saveTourOf(dir, await changeOf(dir), "refunds")

  return { dir, tour: await loadTour(tourPath(dir, "refunds")), cacheDir: await makeCacheDir() }
}

describe("viewContext", () => {
  test("uses the user's own checkout while it's at the tour's revision", async () => {
    const { dir, tour, cacheDir } = await repoWithTour()
    const name = tour.repos[0]?.name ?? ""

    const context = await viewContext(dir, tour, { cacheDir })

    expect(context.roots.get(name)).toBe(await realpath(dir))
    expect(context.stale).toEqual(new Set())
  })

  test("gives the lines the tour's range touches in each file it visits", async () => {
    const { dir, tour, cacheDir } = await repoWithTour()
    const name = tour.repos[0]?.name ?? ""

    const context = await viewContext(dir, tour, { cacheDir })

    expect(context.changedLines.get(name)?.get("app.ts")).toEqual(new Map([[1, "added"]]))
  })

  test("checks out the tour's revision once the branch has moved on, and marks moved steps stale", async () => {
    const { dir, tour, cacheDir } = await repoWithTour()
    const name = tour.repos[0]?.name ?? ""
    await commit(dir, "app.ts", "const total = 300\n")

    const context = await viewContext(dir, tour, { cacheDir, change: await changeOf(dir) })
    const root = context.roots.get(name) ?? ""

    expect(root.startsWith(cacheDir)).toBe(true)
    expect(await readFile(join(root, "app.ts"), "utf8")).toBe("const total = 250\n")
    expect(context.stale).toEqual(new Set(["s1"]))
  })

  test("opens the user's own file after the branch moves on, while it's the tour's version", async () => {
    const { dir, tour, cacheDir } = await repoWithTour()
    const name = tour.repos[0]?.name ?? ""
    await commit(dir, "other.ts", "export {}\n")

    const context = await viewContext(dir, tour, { cacheDir })

    expect(context.own.get(name)).toEqual({ root: await realpath(dir), files: new Set(["app.ts"]) })
    // every file the tour visits is the user's own, so no copy of the tour's is checked out
    expect(context.roots.get(name)).toBe(await realpath(dir))
  })

  test("shows the tour's copy of a file the user has edited since", async () => {
    const { dir, tour, cacheDir } = await repoWithTour()
    const name = tour.repos[0]?.name ?? ""
    await writeFile(join(dir, "app.ts"), "const total = 999\n")

    const context = await viewContext(dir, tour, { cacheDir })

    expect(context.own.get(name)).toEqual({ root: await realpath(dir), files: new Set() })
    expect(context.roots.get(name)?.startsWith(cacheDir)).toBe(true)
  })

  test("names a repo that isn't where the tour says", async () => {
    const { dir, tour, cacheDir } = await repoWithTour()
    const moved = { ...tour, repos: tour.repos.map((repo) => ({ ...repo, source: "../gone" })) }

    const error = await rejection(viewContext(dir, moved, { cacheDir }))

    expect(error).toBeInstanceOf(UnreachableRepoError)
    expect(String(error)).toContain("../gone")
  })

  test("names a repo that lacks the tour's commit", async () => {
    const { dir, tour, cacheDir } = await repoWithTour()
    const missing = "0".repeat(40)
    const rewritten = { ...tour, repos: tour.repos.map((repo) => ({ ...repo, revision: missing })) }

    const error = await rejection(viewContext(dir, rewritten, { cacheDir }))

    expect(String(error)).toContain(`no commit ${missing}`)
  })
})
