import { expect, test } from "bun:test"
import type { Call, NextStop, StepRef, StepView } from "@codetrail/core"
import { callAt, callMarks, narrationLine, sameView } from "../src/view"

test("the narration hangs below the line above the step", () => {
  expect(narrationLine({ path: "a.ts", first: 12, last: 20 })).toBe(11)
})

test("on a file's first line the narration hangs below the step's first line", () => {
  expect(narrationLine({ path: "a.ts", first: 0, last: 4 })).toBe(0)
})

const ref: StepRef = {
  id: "s1",
  repo: "app",
  file: "main.ts",
  path: "/app/main.ts",
  tour_copy: false,
  own_path: null,
  start_line: 1,
  end_line: 3,
  name: null,
  summary: "",
}

function call(id: string, call_line: number | null, fields: Partial<Call> = {}): Call {
  return { ...ref, id, call_line, guessed: false, ...fields }
}

function stepWith(calls: Call[], next: NextStop): StepView {
  return {
    ...ref,
    kind: "step",
    number: 1,
    count: 4,
    step_kind: "call",
    details: "",
    changed: true,
    stale: false,
    changed_lines: [],
    flag: null,
    predicted_values: [],
    stack: [],
    started_by: null,
    calls,
    context: [],
    notes: [],
    came_from: null,
    next,
  }
}

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

test("a move answered with the step it started on went nowhere", () => {
  const view = stepWith([], toPay)

  expect(sameView(view, view)).toBe(true)
  expect(sameView(view, { ...view, id: "s2" })).toBe(false)
})
