import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  branchChoices,
  choiceArguments,
  choiceOfArguments,
  choiceStatus,
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

  test("a pull request's link alone is that pull request, and back again", () => {
    const url = "https://github.com/acme/api/pull/12"

    expect(choiceOfArguments([url])).toEqual({ kind: "pull-request", url })
    expect(choiceArguments({ kind: "pull-request", url })).toEqual([url])
    expect(choiceOfArguments([url, "../web"])).toEqual({ kind: "given", args: [url, "../web"] })
  })

  test("ticked repos follow the change: changed on what they have out, else passed through", () => {
    const repos = [
      { path: "../api", changed: true },
      { path: "../worker", changed: false },
    ]
    const own = choiceArguments({ kind: "own", uncommitted: false, repos })
    const pull = choiceArguments({
      kind: "pull-request",
      url: "https://github.com/acme/web/pull/12",
      repos,
    })

    const read = readChangeArguments(own, (path) => path.startsWith("../"))

    expect(own).toEqual(["...HEAD", "../api", "...HEAD", "../worker"])
    expect(pull).toEqual(["https://github.com/acme/web/pull/12", "../api", "...HEAD", "../worker"])
    expect(read.changes).toMatchObject([
      { kind: "range", range: { head: "HEAD" } },
      { kind: "range", repo: { source: "../api" }, range: { head: "HEAD" } },
    ])
    expect(read.unchanged).toMatchObject([{ source: "../worker" }])
  })

  test("a repo on a chosen branch is read on it; passed through, at its default branch", () => {
    const args = choiceArguments({
      kind: "own",
      uncommitted: false,
      repos: [
        { path: "../billing", changed: true, branch: "refunds-ledger" },
        { path: "../worker", changed: false, branch: "main" },
      ],
    })

    expect(args).toEqual(["...HEAD", "../billing", "...refunds-ledger", "../worker"])
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

describe("choiceStatus", () => {
  test("says whether a trek of the chosen branch exists, without switching to it", async () => {
    const dir = await makeBranchRepo()
    await runGit(dir, ["switch", "--quiet", "-c", "fix/rounding", "main"])
    await commit(dir, "round.ts", "export const round = Math.round\n")

    const other = await choiceStatus(dir, { kind: "branch", name: "feature/refunds" })

    expect(other).toMatchObject({ kind: "missing", name: "feature-refunds" })
    expect(await runGit(dir, ["branch", "--show-current"])).toBe("fix/rounding")
  })
})
