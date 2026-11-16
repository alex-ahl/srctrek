import { describe, expect, test } from "bun:test"
import { mkdir, utimes, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runGit, worktreeStamp } from "../../src"
import { commit, makeBranchRepo, repoAt } from "@srctrek/testing"

describe("worktreeStamp", () => {
  test("stays put while nothing moves", async () => {
    const dir = await makeBranchRepo()

    expect(await worktreeStamp(dir)).toBe(await worktreeStamp(dir))
  })

  test("moves on a commit and on another branch checked out", async () => {
    const dir = await makeBranchRepo()
    const before = await worktreeStamp(dir)

    await commit(dir, "app.ts", "const total = 300\n")
    const committed = await worktreeStamp(dir)
    await runGit(dir, ["switch", "--quiet", "main"])

    expect(committed).not.toBe(before)
    expect(await worktreeStamp(dir)).not.toBe(committed)
  })

  test("moves on a commit in a repo ticked to go along, on its chosen branch", async () => {
    const dir = await makeBranchRepo()
    const api = await repoAt(join(dir, "..", "api"))
    await runGit(api, ["branch", "work"])
    const ticked = [{ path: "../api", changed: true, branch: "work" }]
    const before = await worktreeStamp(dir, ticked)

    await runGit(api, ["switch", "--quiet", "work"])
    await commit(api, "pay.ts", "export const paid = true\n")
    await runGit(api, ["switch", "--quiet", "main"])

    expect(await worktreeStamp(dir, ticked)).not.toBe(before)
  })

  test("moves when a trek is saved, and when one is rewritten in place", async () => {
    const dir = await makeBranchRepo()
    const treks = join(dir, ".srctrek", "treks")
    await mkdir(treks, { recursive: true })
    const before = await worktreeStamp(dir)

    await writeFile(join(treks, "pay.json"), "{}\n")
    const saved = await worktreeStamp(dir)
    await writeFile(join(treks, "pay.json"), '{ "rebuilt": true }\n')
    const later = new Date(Date.now() + 5000)
    await utimes(join(treks, "pay.json"), later, later)

    expect(saved).not.toBe(before)
    expect(await worktreeStamp(dir)).not.toBe(saved)
  })
})
