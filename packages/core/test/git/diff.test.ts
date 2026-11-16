import { describe, expect, test } from "bun:test"
import { changedFiles, changedLines, parseChangedLines, runGit } from "../../src"
import { commit, commitStaged, makeRepo } from "@srctrek/testing"

describe("parseChangedLines", () => {
  test("marks lines that replace old ones as changed and the rest as added", () => {
    expect(parseChangedLines("@@ -5,2 +5,3 @@")).toEqual(
      new Map([
        [5, "changed"],
        [6, "changed"],
        [7, "added"],
      ]),
    )
  })

  test("marks lines inserted where nothing was removed as added", () => {
    expect(parseChangedLines("@@ -0,0 +1,2 @@")).toEqual(
      new Map([
        [1, "added"],
        [2, "added"],
      ]),
    )
  })

  test("reads a missing count as one line", () => {
    expect(parseChangedLines("@@ -3 +3 @@")).toEqual(new Map([[3, "changed"]]))
  })

  test("lists nothing for lines that were only removed", () => {
    expect(parseChangedLines("@@ -8,2 +7,0 @@")).toEqual(new Map())
  })
})

describe("changedLines", () => {
  test("numbers changes as in the new version", async () => {
    const repo = await makeRepo()
    const before = await commit(repo, "app.ts", "a\nb\nc\n")
    const after = await commit(repo, "app.ts", "a\nB\nc\nd\n")

    expect(await changedLines(repo, before, after, "app.ts")).toEqual(
      new Map([
        [2, "changed"],
        [4, "added"],
      ]),
    )
  })
})

describe("changedFiles", () => {
  test("reports added, modified, deleted and renamed files", async () => {
    const repo = await makeRepo()
    await commit(repo, "keep.ts", "keep\n")
    await commit(repo, "drop.ts", "drop\n")
    const before = await commit(repo, "move.ts", "a file long enough that git sees the rename\n")
    await commit(repo, "keep.ts", "kept, but changed\n")
    await commit(repo, "new.ts", "new\n")
    await runGit(repo, ["rm", "--quiet", "drop.ts"])
    await runGit(repo, ["mv", "move.ts", "moved.ts"])
    const after = await commitStaged(repo, "rm and mv")

    const changes = await changedFiles(repo, before, after)

    expect(changes).toContainEqual({ path: "keep.ts", status: "modified" })
    expect(changes).toContainEqual({ path: "new.ts", status: "added" })
    expect(changes).toContainEqual({ path: "drop.ts", status: "deleted" })
    expect(changes).toContainEqual({ path: "moved.ts", status: "renamed", oldPath: "move.ts" })
    expect(changes).toHaveLength(4)
  })
})
