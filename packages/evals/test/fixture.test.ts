import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  blobAt,
  changedFiles,
  citationProblems,
  parseTrek,
  resolveRange,
  parseRange,
  runGit,
} from "@srctrek/core"
import { buildFixture } from "../src/fixture"

const refund = await buildFixture("refund")
const trekPath = join(import.meta.dir, "../../core/test/fixtures/refund-trek.json")
const trek = parseTrek(await Bun.file(trekPath).json(), trekPath)

function repoDir(name: string): string {
  const dir = refund.repos[name]
  if (dir === undefined) {
    throw new Error(`no repo ${name} in the fixture`)
  }

  return dir
}

describe("buildFixture", () => {
  test("builds each repo with a base branch and a feature branch", async () => {
    expect(Object.keys(refund.repos).sort()).toEqual(["api", "web", "worker"])
    for (const dir of Object.values(refund.repos)) {
      expect(await runGit(dir, ["branch", "--format=%(refname:short)"])).toBe("feature\nmain")
    }
  })

  test("puts the change on feature, since the branch point", async () => {
    const api = repoDir("api")
    const range = await resolveRange(api, parseRange("main...feature"))

    expect(await changedFiles(api, range.baseCommit, range.headCommit)).toEqual([
      { path: "openapi.json", status: "modified" },
      { path: "src/db.ts", status: "modified" },
      { path: "src/handlers/index.ts", status: "modified" },
      { path: "src/handlers/refunds.ts", status: "added" },
    ])
  })
})

describe("the refund trek against its fixture", () => {
  test("every step's blob id matches its file at feature", async () => {
    for (const step of trek.steps) {
      expect({
        step: step.id,
        blob: await blobAt(repoDir(step.repo), "feature", step.file),
      }).toEqual({
        step: step.id,
        blob: step.blob,
      })
    }
  })

  test("every line a step relies on exists at feature and isn't blank", async () => {
    const repos = Object.entries(refund.repos).map(([name, dir]) => ({
      name,
      source: name,
      dir,
      revision: "feature",
    }))
    const problems = await Promise.all(trek.steps.map((step) => citationProblems({ repos }, step)))

    expect(problems.flat()).toEqual([])
  })
})
