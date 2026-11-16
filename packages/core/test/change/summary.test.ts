import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { summarizeChange } from "../../src"
import { changeOf, commit, makeBranchRepo } from "@srctrek/testing"

describe("summarizeChange", () => {
  test("names the branch checked out, where the range starts, and its commits", async () => {
    const dir = await makeBranchRepo()
    await commit(dir, "app.ts", "const total = 300\n")

    expect(await summarizeChange(await changeOf(dir))).toEqual({
      changed: [
        {
          repo: basename(dir),
          base: "main",
          head: { kind: "branch", name: "feature/refunds", uncommitted: false },
          commits: 2,
        },
      ],
      unchanged: [],
      code: false,
    })
  })

  test("marks a snapshot of uncommitted work on the branch", async () => {
    const dir = await makeBranchRepo()
    await writeFile(join(dir, "app.ts"), "const total = 300\n")

    const { changed } = await summarizeChange(await changeOf(dir, "", true))
    expect(changed[0]?.head).toEqual({ kind: "branch", name: "feature/refunds", uncommitted: true })
  })
})
