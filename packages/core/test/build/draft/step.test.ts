import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type ResolvedChange,
  type SubmittedStep,
  blobAt,
  citationProblems,
  completeStep,
  resolveRange,
  runGit,
} from "../../../src"
import { rejection } from "../../support/rejection"
import { commit, commitStaged, makeRepo } from "@srctrek/testing"

// api changes src/app.ts line 1 and adds src/refund.ts; web is on the route unchanged.
async function makeChange(): Promise<ResolvedChange> {
  const api = await makeRepo()
  await mkdir(join(api, "src"))
  await writeFile(join(api, "src/app.ts"), "const total = 100\nexport { total }\n")
  await writeFile(join(api, "src/spaced.ts"), "const a = 1\n\nconst b = 2\n")
  await runGit(api, ["add", "--all"])
  await commitStaged(api, "base")
  await runGit(api, ["switch", "--quiet", "-c", "feature"])
  await commit(api, "src/app.ts", "const total = 250\nexport { total }\n")
  const range = await resolveRange(api, { base: "main", head: "HEAD", mode: "since-branch-point" })

  const web = await makeRepo()
  const webHead = await runGit(web, ["rev-parse", "HEAD"])

  return {
    repos: [
      { name: "api", source: ".", dir: api, revision: range.headCommit, range },
      { name: "web", source: "../web", dir: web, revision: webHead },
    ],
  }
}

function stepOn(repo: string, file: string, start: number, end: number): SubmittedStep {
  return {
    id: "s2",
    repo,
    file,
    start_line: start,
    end_line: end,
    kind: "call",
    summary: "a step",
    details: "its details",
    from: "s1",
    via: null,
  }
}

describe("completeStep", () => {
  test("adds the file's blob and whether the change touches the step's lines", async () => {
    const change = await makeChange()
    const api = change.repos[0]

    const touched = await completeStep(change, stepOn("api", "src/app.ts", 1, 2))
    expect(touched.changed).toBe(true)
    expect(touched.blob).toBe((await blobAt(api?.dir ?? "", "HEAD", "src/app.ts")) ?? "")

    expect((await completeStep(change, stepOn("api", "src/app.ts", 2, 2))).changed).toBe(false)
    expect((await completeStep(change, stepOn("web", "README.md", 1, 1))).changed).toBe(false)
  })

  test("says when the file isn't there at the revision", async () => {
    const change = await makeChange()

    expect(
      await rejection(completeStep(change, stepOn("api", "src/nope.ts", 1, 1))),
    ).toHaveProperty(
      "message",
      expect.stringMatching(/^s2: no file src\/nope\.ts in api at [0-9a-f]{7}$/),
    )
  })
})

describe("citationProblems", () => {
  test("finds none when every cited line exists", async () => {
    const change = await makeChange()
    const step = {
      ...stepOn("api", "src/app.ts", 1, 2),
      via: { cites: [{ repo: "web", file: "README.md", line: 1 }], guessed: false },
    }

    expect(await citationProblems(change, step)).toEqual([])
  })

  test("names every line that doesn't exist, so all can be fixed at once", async () => {
    const change = await makeChange()
    const step = {
      ...stepOn("api", "src/app.ts", 1, 9),
      via: {
        cites: [
          { repo: "web", file: "README.md", line: 5 },
          { repo: "web", file: "src/gone.ts", line: 1 },
          { repo: "worker", file: "main.py", line: 1 },
        ],
        guessed: false,
      },
    }

    const problems = await citationProblems(change, step)
    expect(problems).toHaveLength(4)
    expect(problems[0]).toBe("s2: ends at api/src/app.ts:9, past its last line (2)")
    expect(problems[1]).toBe("s2: cites web/README.md:5, past its last line (1)")
    expect(problems[2]).toMatch(/^s2: cites src\/gone\.ts, which isn't in web at [0-9a-f]{7}$/)
    expect(problems[3]).toBe("s2: cites repo worker, which isn't in the change")
  })

  test("names every blank line a step relies on: its ends, its evidence, its values", async () => {
    const change = await makeChange()
    const step = {
      ...stepOn("api", "src/spaced.ts", 2, 3),
      via: { cites: [{ repo: "api", file: "src/spaced.ts", line: 2 }], guessed: false },
      predicted_values: [{ name: "a", value: "1", line: 2, role: "assignment" as const }],
    }

    expect(await citationProblems(change, step)).toEqual([
      "s2: starts at api/src/spaced.ts:2, which is blank",
      "s2: cites api/src/spaced.ts:2, which is blank",
      "s2: puts a on api/src/spaced.ts:2, which is blank",
    ])
    expect(await citationProblems(change, stepOn("api", "src/spaced.ts", 1, 3))).toEqual([])
  })
})
