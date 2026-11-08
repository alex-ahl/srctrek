import { expect, test } from "bun:test"
import type { NextStop } from "@srctrek/core"
import { isNewFile, stepLenses, stepTags, whereNext } from "../src/step-text"
import { statusText } from "../src/view"
import { ref, stepWith } from "./support/views"

const toRefund: NextStop = { how: "into", to: { ...ref, name: "refund" }, line: 11 }

test("the actions above a stop: its number, its flag, its context, and where next goes", () => {
  const view = stepWith([], toRefund, {
    number: 2,
    count: 5,
    flag: { severity: "high", note: "fixed" },
    context: [{ ...ref, id: "s2a" }],
  })

  expect(stepLenses(view)).toEqual([
    { title: "srctrek 2/5", command: "srctrek.stop.focus" },
    { title: "⚠ likely wrong", command: "srctrek.stop.focus" },
    { title: "context", command: "srctrek.context" },
    { title: "next: into refund, line 11 ▸", command: "srctrek.next" },
  ])
})

test("a context step leaves out where next goes, as it isn't on the way", () => {
  const view = stepWith([], toRefund, { step_kind: "context" })

  expect(stepLenses(view).map((lens) => lens.title)).toEqual(["srctrek 1/4"])
})

test("next names where it goes: a hop into another repo names the repo", () => {
  const hop: NextStop = { how: "hop", to: { ...ref, repo: "api", name: "POST /refunds" }, line: 3 }

  expect(whereNext(stepWith([], hop))).toBe("next: ↯ api: POST /refunds")
  expect(whereNext(stepWith([], { how: "end", to: null, line: null }))).toBe(
    "next: the end of the tour",
  )
})

test("the status bar carries the stop and the tags a reader should know", () => {
  const view = stepWith([], toRefund, { changed: false, tour_copy: true, number: 2, count: 5 })

  expect(statusText(view, stepTags(view, false))).toBe(
    "srctrek 2/5 · existing code · tour's version",
  )
  expect(stepTags({ ...view, changed: true }, true)).toEqual(["new file", "tour's version"])
})

test("a file is new when the change adds every line of it", () => {
  const added = [1, 2, 3].map((line) => ({ line, change: "added" as const }))
  const view = stepWith([], toRefund, { changed_lines: added })

  expect(isNewFile(view, 3)).toBe(true)
  expect(isNewFile(view, 4)).toBe(false)
})
