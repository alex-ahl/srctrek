import { expect, test } from "bun:test"
import type { NextStop } from "@srctrek/core"
import { callAt, callMarks } from "../../src/code/call-marks"
import { call, stepWith } from "../support/views"

const toPay: NextStop = { how: "into", to: null, line: 1 }

test("each line making a call gets an arrow, the one next enters from marked", () => {
  const view = stepWith([call("s2", 1), call("s3", 2)], toPay)

  expect(callMarks(view)).toEqual([
    { line: 0, text: "→", leadsNext: true },
    { line: 1, text: "→", leadsNext: false },
  ])
})

test("a guessed link gets a ?, a hop names its repo, and a call with no line gets no arrow", () => {
  const view = stepWith(
    [call("s2", 3, { guessed: true }), call("s3", 3, { repo: "api" }), call("s4", null)],
    { how: "back", to: null, line: null },
  )

  expect(callMarks(view)).toEqual([{ line: 2, text: "→? ↯ api", leadsNext: false }])
})

test("the call at the cursor is the one made on its line of the step's file", () => {
  const view = stepWith([call("s2", 1), call("s3", 2)], toPay)

  expect(callAt(view, "/app/main.ts", 2)?.id).toBe("s3")
  expect(callAt(view, "/app/main.ts", 3)).toBeUndefined()
  expect(callAt(view, "/app/other.ts", 2)).toBeUndefined()
})
