import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { fetchRepo, repoBranches, runGit } from "../../src"
import { commit, makeRepo } from "../support/repo"
import { tempDir } from "../support/temp"

// A remote with main and refunds-v3, cloned; the clone then gets refunds-api of its own.
async function cloneWithBranches(): Promise<{ origin: string; clone: string }> {
  const origin = await makeRepo()
  await commit(origin, "app.ts", "base\n")
  await runGit(origin, ["switch", "--quiet", "-c", "refunds-v3"])
  await commit(origin, "ledger.ts", "ledger\n")
  await runGit(origin, ["switch", "--quiet", "main"])

  const clone = join(await tempDir("clone-"), "api")
  await runGit(origin, ["clone", "--quiet", origin, clone])
  await runGit(clone, ["switch", "--quiet", "-c", "refunds-api"])
  await commit(clone, "refund.ts", "refund\n")
  return { origin, clone }
}

describe("repoBranches", () => {
  test("lists the branches beside the default, local and remote, with who and what", async () => {
    const { clone } = await cloneWithBranches()

    const { base, branches } = await repoBranches(clone)

    expect(base).toBe("origin/main")
    expect(branches.map((b) => [b.name, b.commits, b.checkedOut])).toEqual([
      ["refunds-api", 1, true],
      ["origin/refunds-v3", 1, false],
    ])
    expect(branches[0]).toMatchObject({ subject: "change refund.ts" })
    expect(Date.parse(branches[0]?.committedAt ?? "")).not.toBeNaN()
  })

  test("leaves out a remote's copy of a branch the repo has locally", async () => {
    const { clone } = await cloneWithBranches()
    await runGit(clone, ["switch", "--quiet", "refunds-v3"])

    const { branches } = await repoBranches(clone)

    expect(branches.map((b) => b.name).toSorted()).toEqual(["refunds-api", "refunds-v3"])
  })

  test("fetch brings in a branch pushed since", async () => {
    const { origin, clone } = await cloneWithBranches()
    await runGit(origin, ["switch", "--quiet", "-c", "refunds-v4"])
    await commit(origin, "v4.ts", "v4\n")

    await fetchRepo(clone)
    const { branches } = await repoBranches(clone)

    expect(branches.map((b) => b.name)).toContain("origin/refunds-v4")
  })
})
