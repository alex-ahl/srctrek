import { expect, test } from "bun:test"
import type { NextStop } from "@codetrail/core"
import { callAt, callMarks, changedLinesShown, lineAbove, sameView } from "../src/view"
import { call, stepWith } from "./support/views"

test("the actions sit on the line above the step", () => {
  expect(lineAbove({ path: "a.ts", first: 12, last: 20 })).toBe(11)
})

test("on a file's first line the actions sit on the step's first line", () => {
  expect(lineAbove({ path: "a.ts", first: 0, last: 4 })).toBe(0)
})

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

test("changed lines are marked, except in a file the change adds whole", () => {
  const changed_lines = [
    { line: 2, change: "added" as const },
    { line: 3, change: "changed" as const },
    { line: 9, change: "added" as const },
  ]
  const view = stepWith([], toPay, { changed_lines })

  expect(changedLinesShown(view, false, 4)).toEqual(changed_lines.slice(0, 2))
  expect(changedLinesShown(view, true, 4)).toEqual([])
})
