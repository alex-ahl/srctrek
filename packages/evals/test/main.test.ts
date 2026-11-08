import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runGit } from "@srctrek/core"
import { buildFixture } from "../src/fixture"
import { runEval } from "../src/main"
import { tempDir } from "../../core/test/support/temp"

const refundTrek = join(import.meta.dir, "../../core/test/fixtures/refund-trek.json")

// An agent that saves the hand-made trek and prints a usage line, ignoring its instruction.
async function fakeAgent(): Promise<string> {
  const script = join(await tempDir("agent-"), "agent.sh")
  await writeFile(
    script,
    `mkdir -p .srctrek/treks\ncp '${refundTrek}' .srctrek/treks/eval.json\necho 'used 1234 tokens'\n`,
  )

  return `sh '${script}'`
}

describe("runEval", () => {
  test("runs the agent in the fixture, then scores the trek it saved", async () => {
    const report = await runEval("refund", await fakeAgent())

    expect(report).toContain("Route   10/10 reached, in order")
    expect(report).toContain("Agent   used 1234 tokens")
  })

  test("says when the agent saved no trek, with its last line", async () => {
    // The instruction trek appends becomes $0, so the agent prints only its own line.
    const failure = await runEval("refund", "sh -c 'echo login expired'").then(
      () => "",
      (error: unknown) => String(error),
    )

    expect(failure).toContain("the agent saved no trek; its last line: login expired")
  })

  test("runs trek in another repo when told to", async () => {
    const report = await runEval("refund", await fakeAgent(), { run: { in: "api", args: [] } })

    expect(report).toMatch(/Trek    .*\/api\/\.srctrek\/treks\/eval\.json/)
  })

  test("builds the repos as a reviewer has them: the work only on origin's branches", async () => {
    const fixture = await buildFixture("refund", { asReviewer: true })
    const web = fixture.repos["web"] ?? ""

    expect(await runGit(web, ["branch", "--format=%(refname:short)"])).toBe("main")
    expect(await runGit(web, ["rev-parse", "--abbrev-ref", "origin/HEAD"])).toBe("origin/main")
    expect(await runGit(web, ["rev-parse", "--verify", "--quiet", "origin/feature"])).toMatch(
      /^[0-9a-f]{40}$/,
    )
  })

  test("with --update, commits the follow-ups, updates the trek, and reports both runs", async () => {
    const report = await runEval("refund", await fakeAgent(), { update: true })

    expect(report).toContain("Build   used 1234 tokens")
    expect(report).toMatch(
      /Update  \d+ steps carried over, \d+ redone · \d+ s\n        used 1234 tokens/,
    )
    // two builds, each polled every two seconds
  }, 20_000)

  test("refuses --update on a fixture with no follow-up", async () => {
    const failure = await runEval("expire", await fakeAgent(), { update: true }).then(
      () => "",
      (error: unknown) => String(error),
    )

    expect(failure).toContain("no followup.patch")
  })
})
