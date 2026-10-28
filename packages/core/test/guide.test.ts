import { describe, expect, test } from "bun:test"
import { buildTourPrompt } from "../src"

describe("buildTourPrompt", () => {
  test("guides a tour of a change, ending with open_change's args", () => {
    const guide = buildTourPrompt(["main...feature"])

    expect(guide).toStartWith("Build a codetrail tour of a change")
    expect(guide).toContain("## 3. Follow it in execution order")
    expect(guide).toEndWith('these args: ["main...feature"]')
  })

  test("guides a tour of code as it is, with the trigger the user named", () => {
    const guide = buildTourPrompt(["--code=a refund request"])

    expect(guide).toStartWith("Build a codetrail tour of code as it is")
    expect(guide).toContain(
      'The user asked for this trigger, in their own words: "a refund request".',
    )
    expect(guide).toContain("## 3. Follow it in execution order")
    expect(guide).toEndWith('these args: ["--code=a refund request"]')
  })

  test("leaves the trigger to the agent when none is named", () => {
    expect(buildTourPrompt(["--code"])).toContain("The user named no trigger.")
  })
})
