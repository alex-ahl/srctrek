import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runEval } from "../src/main"
import { tempDir } from "../../core/test/support/temp"

const refundTour = join(import.meta.dir, "../../core/test/fixtures/refund-tour.json")

// An agent that saves the hand-made tour and prints a usage line, ignoring its instruction.
async function fakeAgent(): Promise<string> {
  const script = join(await tempDir("agent-"), "agent.sh")
  await writeFile(
    script,
    `mkdir -p .codetrail/tours\ncp '${refundTour}' .codetrail/tours/eval.json\necho 'used 1234 tokens'\n`,
  )

  return `sh '${script}'`
}

describe("runEval", () => {
  test("runs the agent in the fixture, then scores the tour it saved", async () => {
    const report = await runEval("refund", await fakeAgent())

    expect(report).toContain("Route   10/10 reached, in order")
    expect(report).toContain("Agent   used 1234 tokens")
  })

  test("says when the agent saved no tour, with its last line", async () => {
    // The instruction trail appends becomes $0, so the agent prints only its own line.
    const failure = await runEval("refund", "sh -c 'echo login expired'").then(
      () => "",
      (error: unknown) => String(error),
    )

    expect(failure).toContain("the agent saved no tour; its last line: login expired")
  })

  test("runs trail in another repo when told to", async () => {
    const report = await runEval("refund", await fakeAgent(), { in: "api", args: [] })

    expect(report).toMatch(/Tour    .*\/api\/\.codetrail\/tours\/eval\.json/)
  })
})
