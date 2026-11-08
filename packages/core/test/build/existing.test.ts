import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { existingTourFor, resolveChange, runGit, snapshotWorkingTree, tourNameFor } from "../../src"
import { changeOf, makeBranchRepo, saveTourOf } from "../support/branch"
import { commit } from "../support/repo"
import { makeCacheDir, makeRemote } from "../support/remote"

describe("existingTourFor", () => {
  test("finds the saved tour of exactly this change, and none once the change moves on", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTourOf(dir, change, "refunds")
    await writeFile(join(dir, ".srctrek/tours/broken.json"), "{")

    expect(await existingTourFor(dir, change)).toBe("refunds")

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await existingTourFor(dir, await changeOf(dir))).toBeUndefined()
  })

  test("finds none when there are no tours at all", async () => {
    const dir = await makeBranchRepo()
    await mkdir(join(dir, ".srctrek"))

    expect(await existingTourFor(dir, await changeOf(dir))).toBeUndefined()
  })
})

describe("tourNameFor", () => {
  test("names a tour after the branch, a named head, or uncommitted work", async () => {
    const dir = await makeBranchRepo()
    expect(await tourNameFor(await changeOf(dir))).toBe("feature-refunds")
    expect(await tourNameFor(await changeOf(dir, "main...feature/refunds"))).toBe("feature-refunds")

    await writeFile(join(dir, "app.ts"), "not committed\n")
    expect(await tourNameFor(await changeOf(dir, "", true))).toBe("feature-refunds-uncommitted")
  })

  test("names a tour after the commit when nothing is checked out", async () => {
    const dir = await makeBranchRepo()
    const head = await runGit(dir, ["rev-parse", "HEAD"])
    await runGit(dir, ["switch", "--quiet", "--detach"])

    expect(await tourNameFor(await changeOf(dir))).toBe(head.slice(0, 7))
  })

  test("names a pull request's tour after its number", async () => {
    const remote = await makeRemote()
    const pr = {
      url: "https://host.test/acme/pay/pull/1",
      name: "pay",
      cloneUrl: remote.url,
      number: 1,
      ref: "refs/pull/1/head",
    }
    const args = {
      changes: [{ kind: "pull-request" as const, pr }],
      unchanged: [],
      uncommitted: false,
    }
    const change = await resolveChange(remote.dir, args, await makeCacheDir())

    expect(await tourNameFor(change)).toBe("pr-1")
  })
})

test("a snapshot is told apart by its ref, not by its shape", async () => {
  const dir = await makeBranchRepo()
  const head = await runGit(dir, ["rev-parse", "HEAD"])

  expect(await tourNameFor(await changeOf(dir, `main..${head}`))).toBe(head)
  expect(await snapshotWorkingTree(dir)).toBe(head)
})
