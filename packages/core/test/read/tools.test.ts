import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type ResolvedRepo,
  changeFiles,
  changePatch,
  listFiles,
  readLines,
  repoNamed,
  resolveRange,
  runGit,
  search,
} from "../../src"
import { rejection } from "../support/rejection"
import { commit, commitStaged, makeRepo } from "@srctrek/testing"

// "api": src/app.ts and docs/notes.md on main; the change edits app.ts and adds src/refund.ts.
// A further edit to app.ts stays uncommitted and must never show.
async function makeApi(): Promise<ResolvedRepo> {
  const dir = await makeRepo()
  await mkdir(join(dir, "src"))
  await mkdir(join(dir, "docs"))
  await writeFile(join(dir, "src/app.ts"), "const total = 100\nexport { total }\n")
  await writeFile(join(dir, "docs/notes.md"), "total is in cents\n")
  await runGit(dir, ["add", "--all"])
  await commitStaged(dir, "base")

  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  await commit(dir, "src/app.ts", "const total = 250\nexport { total }\n")
  await commit(dir, "src/refund.ts", "export const refund = (total: number) => -total\n")
  await writeFile(join(dir, "src/app.ts"), "uncommitted\n")

  const range = await resolveRange(dir, { base: "main", head: "HEAD", mode: "since-branch-point" })
  return { name: "api", source: ".", dir, revision: range.headCommit, range }
}

describe("read tools", () => {
  test("list a folder's own entries, folders marked, or every file below it", async () => {
    const api = await makeApi()

    expect(await listFiles(api)).toEqual({
      paths: ["README.md", "docs/", "src/"],
      truncated: false,
    })
    expect((await listFiles(api, "src")).paths).toEqual(["src/app.ts", "src/refund.ts"])
    expect((await listFiles(api, undefined, true)).paths).toEqual([
      "README.md",
      "docs/notes.md",
      "src/app.ts",
      "src/refund.ts",
    ])
  })

  test("cut a long listing, saying so", async () => {
    const api = await makeApi()
    await mkdir(join(api.dir, "gen"))
    for (const i of Array.from({ length: 520 }, (_, n) => n)) {
      await writeFile(join(api.dir, `gen/f${i}.ts`), "x\n")
    }
    await runGit(api.dir, ["add", "--all"])
    const head = await commitStaged(api.dir, "many files")
    const later = { ...api, revision: head }

    const listing = await listFiles(later, "gen")
    expect(listing.paths).toHaveLength(500)
    expect(listing.truncated).toBe(true)
  })

  test("read numbered lines at the revision, never the working copy", async () => {
    const api = await makeApi()

    expect(await readLines(api, "src/app.ts")).toEqual({
      path: "src/app.ts",
      start: 1,
      lines: ["const total = 250", "export { total }"],
      total: 2,
    })
    expect((await readLines(api, "src/app.ts", 2, 2)).lines).toEqual(["export { total }"])
    expect(await rejection(readLines(api, "src/nope.ts"))).toHaveProperty(
      "message",
      expect.stringMatching(/^no file src\/nope\.ts in api at [0-9a-f]{7}$/),
    )
  })

  test("read at most 400 lines unless asked for others, saying how many the file has", async () => {
    const api = await makeApi()
    const long = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`).join("\n") + "\n"
    const head = await commit(api.dir, "long.ts", long)
    const later = { ...api, revision: head }

    const first = await readLines(later, "long.ts")
    expect(first.lines).toHaveLength(400)
    expect(first.total).toBe(1000)
    expect((await readLines(later, "long.ts", 990)).lines).toEqual(
      Array.from({ length: 11 }, (_, i) => `line ${990 + i}`),
    )
  })

  test("search with a regular expression, nothing found being an answer", async () => {
    const api = await makeApi()

    expect(await search(api, "total = [0-9]+")).toEqual({
      matches: [{ path: "src/app.ts", line: 1, text: "const total = 250" }],
      truncated: false,
    })
    expect((await search(api, "total", "docs")).matches).toEqual([
      { path: "docs/notes.md", line: 1, text: "total is in cents" },
    ])
    expect(await search(api, "nowhere")).toEqual({ matches: [], truncated: false })
    expect(await rejection(search(api, "("))).toBeInstanceOf(Error)
  })

  test("show the change's files and a file's patch", async () => {
    const api = await makeApi()

    expect(await changeFiles(api)).toEqual({
      files: [
        { path: "src/app.ts", status: "modified" },
        { path: "src/refund.ts", status: "added" },
      ],
      truncated: false,
    })
    const { patch, cutLines } = await changePatch(api, "src/app.ts")
    expect(patch).toContain("-const total = 100\n+const total = 250\n")
    expect(cutLines).toBe(0)
  })

  test("say when a repo has no changes, or there's no repo by that name", async () => {
    const api = await makeApi()
    const { range: _, ...unchanged } = api

    expect(await rejection(changeFiles(unchanged))).toHaveProperty(
      "message",
      expect.stringContaining("has no changes: it's on the route unchanged"),
    )
    expect(() => repoNamed({ repos: [api] }, "web")).toThrow(
      "no repo named web; the change has api",
    )
  })
})
