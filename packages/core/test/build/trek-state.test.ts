import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { TREKS_DIR, loadTrek, resolveChange, runGit, trekState } from "../../src"
import { changeOf, makeBranchRepo, saveTrekOf } from "../support/branch"
import { makeCacheDir } from "../support/remote"
import { commit } from "../support/repo"

// The trek saved as `name` in `dir`, where it stands now.
async function stateOf(dir: string, name: string) {
  return trekState(dir, await loadTrek(join(dir, TREKS_DIR, `${name}.json`)))
}

describe("trekState", () => {
  test("is current while its branch is where the trek left it", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "refunds")

    expect(await stateOf(dir, "refunds")).toEqual({ kind: "current" })
  })

  test("is stale once its branch moves on, counting the stops whose files changed", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "refunds")
    await commit(dir, "app.ts", "const total = 300\n")

    expect(await stateOf(dir, "refunds")).toEqual({ kind: "stale", staleStops: 1, stops: 1 })
  })

  test("is done once its branch is merged into the base branch", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "refunds")
    await runGit(dir, ["switch", "--quiet", "main"])
    await runGit(dir, ["merge", "--quiet", "--ff-only", "feature/refunds"])

    expect(await stateOf(dir, "refunds")).toEqual({ kind: "done", why: "merged" })
  })

  test("is done once its branch is gone", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "refunds")
    await runGit(dir, ["switch", "--quiet", "main"])
    await runGit(dir, ["branch", "--quiet", "-D", "feature/refunds"])

    expect(await stateOf(dir, "refunds")).toEqual({ kind: "done", why: "gone" })
  })

  test("of uncommitted work is current until the branch moves, and done once it's committed", async () => {
    const dir = await makeBranchRepo()
    await writeFile(join(dir, "app.ts"), "const total = 300\n")
    await saveTrekOf(dir, await changeOf(dir, "", true), "work")
    expect(await stateOf(dir, "work")).toEqual({ kind: "current" })

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await stateOf(dir, "work")).toEqual({ kind: "done", why: "committed" })
  })

  test("of code as it is is stale once the checkout moves on", async () => {
    const dir = await makeBranchRepo()
    const code = async () =>
      resolveChange(
        dir,
        {
          changes: [],
          unchanged: [{ source: "." }],
          uncommitted: false,
          code: { trigger: "a refund" },
        },
        await makeCacheDir(),
      )
    await saveTrekOf(dir, await code(), "a-refund")
    expect(await stateOf(dir, "a-refund")).toEqual({ kind: "current" })

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await stateOf(dir, "a-refund")).toEqual({ kind: "stale", staleStops: 1, stops: 1 })
  })

  test("can't be opened when a local repo it names isn't there", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "refunds")
    const path = join(dir, TREKS_DIR, "refunds.json")
    const trek = await loadTrek(path)
    const worker = { name: "worker", source: "../no-worker", revision: "a".repeat(40) }

    expect(await trekState(dir, { ...trek, repos: [...trek.repos, worker] })).toMatchObject({
      kind: "unreachable",
      unreachable: { repo: "worker", reason: "missing" },
    })
  })
})
