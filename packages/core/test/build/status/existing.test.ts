import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  existingTrekFor,
  resolveChange,
  runGit,
  snapshotWorkingTree,
  trekNameFor,
} from "../../../src/index"
import {
  changeOf,
  commit,
  makeBranchRepo,
  makeCacheDir,
  makeRemote,
  saveTrekOf,
} from "@srctrek/testing"

describe("existingTrekFor", () => {
  test("finds the saved trek of exactly this change, and none once the change moves on", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTrekOf(dir, change, "refunds")
    await writeFile(join(dir, ".srctrek/treks/broken.json"), "{")

    expect(await existingTrekFor(dir, change)).toBe("refunds")

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await existingTrekFor(dir, await changeOf(dir))).toBeUndefined()
  })

  test("finds none when there are no treks at all", async () => {
    const dir = await makeBranchRepo()
    await mkdir(join(dir, ".srctrek"))

    expect(await existingTrekFor(dir, await changeOf(dir))).toBeUndefined()
  })
})

describe("trekNameFor", () => {
  test("names a trek after the branch, a named head, or uncommitted work", async () => {
    const dir = await makeBranchRepo()
    expect(await trekNameFor(await changeOf(dir))).toBe("feature-refunds")
    expect(await trekNameFor(await changeOf(dir, "main...feature/refunds"))).toBe("feature-refunds")

    await writeFile(join(dir, "app.ts"), "not committed\n")
    expect(await trekNameFor(await changeOf(dir, "", true))).toBe("feature-refunds-uncommitted")
  })

  test("names a trek after the commit when nothing is checked out", async () => {
    const dir = await makeBranchRepo()
    const head = await runGit(dir, ["rev-parse", "HEAD"])
    await runGit(dir, ["switch", "--quiet", "--detach"])

    expect(await trekNameFor(await changeOf(dir))).toBe(head.slice(0, 7))
  })

  test("names a pull request's trek after its number", async () => {
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

    expect(await trekNameFor(change)).toBe("pr-1")
  })
})

test("a snapshot is told apart by its ref, not by its shape", async () => {
  const dir = await makeBranchRepo()
  const head = await runGit(dir, ["rev-parse", "HEAD"])

  expect(await trekNameFor(await changeOf(dir, `main..${head}`))).toBe(head)
  expect(await snapshotWorkingTree(dir)).toBe(head)
})
