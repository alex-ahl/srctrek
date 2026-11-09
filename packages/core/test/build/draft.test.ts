import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { TREKS_DIR, loadTrek } from "../../src"
import { changeOf, makeBranchRepo, saveTrekOf } from "../support/branch"

describe("draftToTrek", () => {
  test("records the branch each changed repo's range ends at", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "refunds")

    const [repo] = (await loadTrek(join(dir, TREKS_DIR, "refunds.json"))).repos
    expect(repo?.head).toEqual({ kind: "branch", name: "feature/refunds", uncommitted: false })
  })

  test("marks the head of a trek of uncommitted work", async () => {
    const dir = await makeBranchRepo()
    await writeFile(join(dir, "app.ts"), "const total = 300\n")
    await saveTrekOf(dir, await changeOf(dir, "", true), "work")

    const [repo] = (await loadTrek(join(dir, TREKS_DIR, "work.json"))).repos
    expect(repo?.head).toEqual({ kind: "branch", name: "feature/refunds", uncommitted: true })
  })
})
