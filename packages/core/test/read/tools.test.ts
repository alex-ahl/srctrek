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
import { commit, commitStaged, makeRepo } from "../support/repo"
import { rejection } from "../support/rejection"

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
  test("list the files at the revision, or those under a folder", async () => {
    const api = await makeApi()

    expect(await listFiles(api)).toEqual([
      "README.md",
      "docs/notes.md",
      "src/app.ts",
      "src/refund.ts",
    ])
    expect(await listFiles(api, "src")).toEqual(["src/app.ts", "src/refund.ts"])
  })

  test("read numbered lines at the revision, never the working copy", async () => {
    const api = await makeApi()

    expect(await readLines(api, "src/app.ts")).toEqual({
      path: "src/app.ts",
      start: 1,
      lines: ["const total = 250", "export { total }"],
    })
    expect((await readLines(api, "src/app.ts", 2, 2)).lines).toEqual(["export { total }"])
    expect(await rejection(readLines(api, "src/nope.ts"))).toHaveProperty(
      "message",
      expect.stringMatching(/^no file src\/nope\.ts in api at [0-9a-f]{7}$/),
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

    expect(await changeFiles(api)).toEqual([
      { path: "src/app.ts", status: "modified" },
      { path: "src/refund.ts", status: "added" },
    ])
    expect(await changePatch(api, "src/app.ts")).toContain(
      "-const total = 100\n+const total = 250\n",
    )
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
