import { describe, expect, test } from "bun:test"
import { readFileAt } from "@srctrek/core"
import { type Expected, type ExpectedLine, type ExpectedPlace, readExpected } from "../src/expected"
import { buildFixture, fixtureNames } from "../src/fixture"

// Every line expected.json points at: both ends of each route entry, link evidence, bug lines,
// and the line each stack is checked at.
function citedLines(expected: Expected): ExpectedLine[] {
  const routeEnds = expected.route.flatMap(({ repo, file, lines }) =>
    lines.map((line) => ({ repo, file, line })),
  )
  const evidence = expected.links.flatMap((link) => link.evidence)
  const bugLines = expected.bugs.flatMap((bug) => bug.files)
  const stackLines = expected.stacks.map((stack) => stack.at)

  return [...routeEnds, ...evidence, ...bugLines, ...stackLines]
}

// The files the expected stacks name as frames, which must exist at the change's end.
async function missingFrameFiles(repos: Record<string, string>, expected: Expected) {
  const frames = expected.stacks.flatMap((stack) => stack.frames)
  const missing = async ({ repo, file }: ExpectedPlace) => {
    const dir = repos[repo]
    const text = dir === undefined ? undefined : await readFileAt(dir, "feature", file)
    return text === undefined ? [`${repo} ${file}: no such file`] : []
  }

  return (await Promise.all(frames.map(missing))).flat()
}

// Why a cited line can't be what the fixture means, at the change's end: missing or blank.
async function lineProblem(repos: Record<string, string>, cited: ExpectedLine): Promise<string[]> {
  const where = `${cited.repo} ${cited.file}:${cited.line}`
  const dir = repos[cited.repo]
  const text = dir === undefined ? undefined : await readFileAt(dir, "feature", cited.file)
  if (text === undefined) {
    return [`${where}: no such file`]
  }

  const line = text.split("\n")[cited.line - 1]

  return line === undefined || line.trim() === "" ? [`${where}: missing or blank`] : []
}

const names = await fixtureNames()

describe("every fixture's expected.json", () => {
  for (const name of names) {
    test(`${name}: runs in one of its repos and cites lines and files that exist`, async () => {
      const fixture = await buildFixture(name)
      const expected = await readExpected(fixture.dir)
      const problems = await Promise.all(
        citedLines(expected).map((cited) => lineProblem(fixture.repos, cited)),
      )

      expect(Object.keys(fixture.repos)).toContain(expected.run.in)
      expect(problems.flat()).toEqual([])
      expect(await missingFrameFiles(fixture.repos, expected)).toEqual([])
    })
  }
})
