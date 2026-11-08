import { describe, expect, test } from "bun:test"
import { buildTourPrompt } from "../src"

describe("buildTourPrompt", () => {
  test("guides a tour of a change, ending with open_change's args", () => {
    const guide = buildTourPrompt(["main...feature"])

    expect(guide).toStartWith("Build a srctrek tour of a change")
    expect(guide).toContain("## 3. Follow it in execution order")
    expect(guide).toEndWith('these args: ["main...feature"]')
  })

  test("guides a tour of code as it is, with the trigger the user named", () => {
    const guide = buildTourPrompt(["--code=a refund request"])

    expect(guide).toStartWith("Build a srctrek tour of code as it is")
    expect(guide).toContain(
      'The user asked for this trigger, in their own words: "a refund request".',
    )
    expect(guide).toContain("## 3. Follow it in execution order")
    expect(guide).toEndWith('these args: ["--code=a refund request"]')
  })

  test("asks for the code's triggers, not a tour, when none is named", () => {
    const guide = buildTourPrompt(["--code"])

    expect(guide).toStartWith("Find the ways this code is used, so the user can choose")
    expect(guide).toContain('Call open_change with these args: ["--code"].')
    expect(guide).not.toContain("start_tour")
  })
})
