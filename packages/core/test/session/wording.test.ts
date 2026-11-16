import { describe, expect, test } from "bun:test"
import { cameFromLabel, nextText } from "../../src/session/wording"

const refund = { repo: "web", file: "src/handlers/refunds.ts", start_line: 8, name: "refund" }

describe("nextText", () => {
  test("names the step it goes into, and the line making the call", () => {
    expect(nextText({ how: "into", to: refund, line: 11 }, "web")).toBe(
      "next: into refund, line 11",
    )
  })

  test("names a step without a name by its short place", () => {
    const unnamed = { ...refund, name: null }

    expect(nextText({ how: "on", to: unnamed, line: null }, "web")).toBe(
      "next: handlers/refunds.ts:8",
    )
  })

  test("a hop names its repo only when it leaves this one", () => {
    const api = { ...refund, repo: "api", name: "POST /refunds" }

    expect(nextText({ how: "hop", to: api, line: 3 }, "web")).toBe("next: ↯ api: POST /refunds")
    expect(nextText({ how: "hop", to: api, line: 3 }, "api")).toBe("next: ↯ POST /refunds")
  })

  test("says when next goes back to a caller, or ends the trek", () => {
    expect(nextText({ how: "back", to: refund, line: null }, "web")).toBe("next: back to refund")
    expect(nextText({ how: "end", to: null, line: null }, "web")).toBe("next: the end of the trek")
  })
})

describe("cameFromLabel", () => {
  test("words how a step relates to the one before it", () => {
    expect(cameFromLabel("from", "call")).toBe("Reached from")
    expect(cameFromLabel("from", "hop")).toBe("Reached by a hop from")
    expect(cameFromLabel("for", "context")).toBe("Explains")
  })
})
