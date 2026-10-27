import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type ResolvedChange,
  TourDraft,
  existingTourFor,
  parseRange,
  resolveChange,
  runGit,
  saveTour,
  snapshotWorkingTree,
  tourNameFor,
} from "../../src"
import { commit, makeRepo } from "../support/repo"
import { makeCacheDir, makeRemote } from "../support/remote"

// A repo on branch feature/refunds, one commit ahead of main.
async function makeBranchRepo(): Promise<string> {
  const dir = await makeRepo()
  await runGit(dir, ["switch", "--quiet", "-c", "feature/refunds"])
  await commit(dir, "app.ts", "const total = 250\n")

  return dir
}

async function changeOf(dir: string, range = "", uncommitted = false): Promise<ResolvedChange> {
  const args = {
    changes: [{ kind: "range" as const, repo: { source: "." }, range: parseRange(range) }],
    unchanged: [],
    uncommitted,
  }

  return resolveChange(dir, args, await makeCacheDir())
}

async function saveTourOf(dir: string, change: ResolvedChange, name: string): Promise<void> {
  const header = {
    title: "t",
    overview: "o",
    trigger: { kind: "command" as const, input: "i" },
    outcome: "x",
    sources: [],
    author: { model: "m" },
  }
  const draft = new TourDraft(change, header)
  const repo = change.repos[0]?.name ?? ""
  const step = {
    id: "s1",
    repo,
    file: "app.ts",
    start_line: 1,
    end_line: 1,
    kind: "context" as const,
    summary: "s",
    details: "d",
    via: null,
  }
  expect(await draft.add([step])).toEqual([])
  await saveTour(dir, name, draft.toTour())
}

describe("existingTourFor", () => {
  test("finds the saved tour of exactly this change, and none once the change moves on", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTourOf(dir, change, "refunds")
    await writeFile(join(dir, ".codetrail/tours/broken.json"), "{")

    expect(await existingTourFor(dir, change)).toBe("refunds")

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await existingTourFor(dir, await changeOf(dir))).toBeUndefined()
  })

  test("finds none when there are no tours at all", async () => {
    const dir = await makeBranchRepo()
    await mkdir(join(dir, ".codetrail"))

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
