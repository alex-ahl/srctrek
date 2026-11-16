import { describe, expect, test } from "bun:test"
import { GitError, detectBase, parseRange, resolveRange, runGit } from "../../src"
import { rejection } from "../support/rejection"
import { commit, makeRepo } from "@srctrek/testing"

describe("parseRange", () => {
  test("reads the three-dot form as changes since the branch point", () => {
    expect(parseRange("main...feature")).toEqual({
      base: "main",
      head: "feature",
      mode: "since-branch-point",
    })
  })

  test("reads the two-dot form as a direct comparison", () => {
    expect(parseRange("v1..v2")).toEqual({ base: "v1", head: "v2", mode: "direct" })
  })

  test("leaves the base to be detected when only a head is given", () => {
    expect(parseRange("feature")).toEqual({
      base: undefined,
      head: "feature",
      mode: "since-branch-point",
    })
    expect(parseRange("")).toEqual({ base: undefined, head: "HEAD", mode: "since-branch-point" })
    expect(parseRange("main...")).toEqual({
      base: "main",
      head: "HEAD",
      mode: "since-branch-point",
    })
  })

  test("rejects text with more than one range in it", () => {
    expect(() => parseRange("a...b...c")).toThrow("not a range")
  })
})

describe("detectBase", () => {
  test("uses the remote's default branch when it is known", async () => {
    const upstream = await makeRepo()
    await runGit(upstream, ["branch", "-m", "main", "develop"])
    const clone = `${upstream}-clone`
    await runGit(upstream, ["clone", "--quiet", upstream, clone])
    expect(await detectBase(clone)).toBe("origin/develop")
  })

  test("falls back to a local main without a remote", async () => {
    expect(await detectBase(await makeRepo())).toBe("main")
  })

  test("fails clearly when there is no base branch", async () => {
    const repo = await makeRepo()
    await runGit(repo, ["branch", "-m", "main", "trunk"])
    expect(String(await rejection(detectBase(repo)))).toContain("no base branch")
  })
})

describe("resolveRange", () => {
  test("since the branch point, ignoring what the base did after the branch was cut", async () => {
    const repo = await makeRepo()
    const branchPoint = await runGit(repo, ["rev-parse", "HEAD"])
    await runGit(repo, ["checkout", "--quiet", "-b", "feature"])
    const featureHead = await commit(repo, "feature.txt", "new\n")
    await runGit(repo, ["checkout", "--quiet", "main"])
    await commit(repo, "later.txt", "main moved on\n")

    const range = await resolveRange(repo, parseRange("main...feature"))

    expect(range).toEqual({
      base: "main",
      head: "feature",
      mode: "since-branch-point",
      baseCommit: branchPoint,
      headCommit: featureHead,
    })
  })

  test("compares the two ends as they are in the direct form", async () => {
    const repo = await makeRepo()
    await runGit(repo, ["checkout", "--quiet", "-b", "feature"])
    await commit(repo, "feature.txt", "new\n")
    await runGit(repo, ["checkout", "--quiet", "main"])
    const mainHead = await commit(repo, "later.txt", "main moved on\n")

    const range = await resolveRange(repo, parseRange("main..feature"))

    expect(range.baseCommit).toBe(mainHead)
  })

  test("detects the base when none is given", async () => {
    const repo = await makeRepo()
    await runGit(repo, ["checkout", "--quiet", "-b", "feature"])
    await commit(repo, "feature.txt", "new\n")

    expect((await resolveRange(repo, parseRange(""))).base).toBe("main")
  })

  test("reports a branch that doesn't exist as a git error", async () => {
    const repo = await makeRepo()
    expect(await rejection(resolveRange(repo, parseRange("main...nope")))).toBeInstanceOf(GitError)
  })
})
