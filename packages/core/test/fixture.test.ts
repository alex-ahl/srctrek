import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  blobAt,
  changedFiles,
  parseTour,
  readFileAt,
  resolveRange,
  parseRange,
  runGit,
} from "../src"
import { buildFixture } from "./support/fixture"

const refund = await buildFixture("refund")
const tourPath = join(import.meta.dir, "fixtures/refund-tour.json")
const tour = parseTour(await Bun.file(tourPath).json(), tourPath)

function repoDir(name: string): string {
  const dir = refund.repos[name]
  if (dir === undefined) throw new Error(`no repo ${name} in the fixture`)
  return dir
}

async function lineCount(repo: string, file: string): Promise<number> {
  const text = await readFileAt(repoDir(repo), "feature", file)
  return text === undefined ? 0 : text.split("\n").length - 1
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

describe("the refund tour against its fixture", () => {
  test("every step's blob id matches its file at feature", async () => {
    for (const step of tour.steps) {
      expect({
        step: step.id,
        blob: await blobAt(repoDir(step.repo), "feature", step.file),
      }).toEqual({
        step: step.id,
        blob: step.blob,
      })
    }
  })

  test("every step's lines and every cited line exist at feature", async () => {
    for (const step of tour.steps) {
      expect(step.end_line).toBeLessThanOrEqual(await lineCount(step.repo, step.file))
      for (const cite of step.via?.cites ?? []) {
        expect(cite.line).toBeLessThanOrEqual(await lineCount(cite.repo, cite.file))
      }
    }
  })
})
