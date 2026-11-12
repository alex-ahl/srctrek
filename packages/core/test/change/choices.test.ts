import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  branchChoices,
  choiceArguments,
  choiceOfArguments,
  readChangeArguments,
  runGit,
} from "../../src"
import { makeBranchRepo } from "../support/branch"
import { commit } from "../support/repo"

describe("choiceArguments and choiceOfArguments", () => {
  test("no arguments, or only --uncommitted, is the user's own branch, and back again", () => {
    expect(choiceOfArguments([])).toEqual({ kind: "own", uncommitted: false })
    expect(choiceOfArguments(["--uncommitted"])).toEqual({ kind: "own", uncommitted: true })
    expect(choiceArguments({ kind: "own", uncommitted: false })).toEqual([])
    expect(choiceArguments({ kind: "own", uncommitted: true })).toEqual(["--uncommitted"])
  })

  test("other arguments are kept as given", () => {
    const given = choiceOfArguments(["main...feature", "../api"])

    expect(given).toEqual({ kind: "given", args: ["main...feature", "../api"] })
    expect(choiceArguments(given)).toEqual(["main...feature", "../api"])
  })

  test("names a branch as a range from the base, even where a folder has its name", () => {
    const args = choiceArguments({ kind: "branch", name: "feature/refunds" })
    const folderNamedLikeIt = (path: string) => path === "feature/refunds"

    const read = readChangeArguments(args, folderNamedLikeIt)

    expect(args).toEqual(["...feature/refunds"])
    expect(read.changes).toMatchObject([{ kind: "range", range: { head: "feature/refunds" } }])
  })
})

describe("branchChoices", () => {
  test("the checked-out branch, files not yet committed, and other branches with work", async () => {
    const dir = await makeBranchRepo()
    await runGit(dir, ["switch", "--quiet", "-c", "fix/rounding", "main"])
    await commit(dir, "round.ts", "export const round = Math.round\n")
    await runGit(dir, ["switch", "--quiet", "-c", "merged", "main"])
    await runGit(dir, ["switch", "--quiet", "feature/refunds"])
    await writeFile(join(dir, "app.ts"), "const total = 275\n")

    const choices = await branchChoices(dir)

    expect(choices.base).toBe("main")
    expect(choices.own).toEqual({ name: "feature/refunds", commits: 1 })
    expect(choices.uncommittedFiles).toBe(1)
    expect(choices.others).toEqual([{ name: "fix/rounding", commits: 1 }])
  })
})
