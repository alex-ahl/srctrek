import { describe, expect, test } from "bun:test"
import { parseTrek } from "@srctrek/core"
import { REFUND_TREK_PATH } from "@srctrek/testing"
import { type RunRecord, compareLine, summaryOf, withRuns } from "../src/baseline"
import { readExpected } from "../src/expected"
import { fixtureDir } from "../src/fixture"
import { scoreTrek } from "../src/score"

const refundTrek = parseTrek(await Bun.file(REFUND_TREK_PATH).json(), REFUND_TREK_PATH)
const expected = await readExpected(fixtureDir("refund"))

const run = (turns: number, more: Partial<RunRecord> = {}): RunRecord => ({
  score: { route: "10/10", inOrder: true, links: "2/2", bugs: "1/1", stacks: "4/4" },
  seconds: 120,
  numbers: { num_turns: turns, "usage.output_tokens": 12000 },
  ...more,
})

const entry = { commit: "abc1234", runs: [run(33), run(40, { seconds: 140 })] }
const watch = ["num_turns"]

describe("the baseline", () => {
  test("keeps a score in a few words", () => {
    expect(summaryOf(scoreTrek(refundTrek, expected))).toEqual(run(0).score)
  })

  test("compares only the agent's numbers it's told to watch", () => {
    expect(compareLine(run(90), entry, [])).toBe("✓ as the baseline (2 runs at abc1234)")
  })

  test("lets a number fall a little outside the range, as two runs give a narrow one", () => {
    expect(compareLine(run(44), entry, watch)).toBe("✓ as the baseline (2 runs at abc1234)")
  })

  test("passes a run that scores as a baseline run did, its numbers in their range", () => {
    expect(compareLine(run(36, { seconds: 130 }), entry, watch)).toBe(
      "✓ as the baseline (2 runs at abc1234)",
    )
  })

  test("holds a score to the best baseline run's, when one run missed what the other found", () => {
    const missed = run(36, { score: { ...run(0).score, bugs: "0/1" } })
    const flaky = { commit: "abc1234", runs: [run(33), missed] }

    expect(compareLine(missed, flaky, watch)).toBe("✗ bugs 0/1 (best 1/1)  (2 runs at abc1234)")
  })

  test("names where the score falls short, and each number well outside its range", () => {
    const worse = run(52, { score: { ...run(0).score, route: "9/10", inOrder: false } })

    expect(compareLine(worse, entry, watch)).toBe(
      "✗ route 9/10 (best 10/10) · out of order (best in order) · num_turns 52 (33–40)  (2 runs at abc1234)",
    )
  })

  test("replaces one fixture's runs, keeping the others'", () => {
    const first = withRuns(undefined, "refund", "abc1234", [run(33)])
    const both = withRuns(first, "expire", "def5678", [run(19)])

    expect(Object.keys(withRuns(both, "refund", "def5678", [run(30)]).fixtures)).toEqual([
      "refund",
      "expire",
    ])
  })
})
