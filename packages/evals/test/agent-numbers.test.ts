import { describe, expect, test } from "bun:test"
import { agentNumbers } from "../src/agent-numbers"

describe("agentNumbers", () => {
  test("shows a JSON line's numbers other than zero, top level, then one level down", () => {
    const line = JSON.stringify({
      cost: 0.58,
      turns: 34,
      queued: 0,
      result: "saved the tour",
      usage: { input: 26, cached: 390329, output: 10496, searches: 0 },
      steps: [{ tokens: 5 }],
      empty: { searches: 0 },
    })

    expect(agentNumbers(line)).toEqual([
      "cost 0.58 · turns 34",
      "usage: input 26 · cached 390329 · output 10496",
    ])
  })

  test("leaves any other line as it is", () => {
    expect(agentNumbers("used 1234 tokens")).toEqual(["used 1234 tokens"])
    expect(agentNumbers("[1, 2]")).toEqual(["[1, 2]"])
  })
})
