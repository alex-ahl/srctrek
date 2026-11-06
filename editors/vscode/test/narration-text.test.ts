import { expect, test } from "bun:test"
import type { NextStop } from "@codetrail/core"
import { isNewFile, panelBody, panelLabel, whereNext } from "../src/narration-text"
import { ref, stepWith } from "./support/views"

const toRefund: NextStop = { how: "into", to: { ...ref, name: "refund" }, line: 11 }

test("the body keeps the narration's spaces, so it wraps, and its markdown as text", () => {
  const view = stepWith([], toRefund, { summary: "Calls *pay* first." })

  expect(panelBody(view)).toBe("Calls \\*pay\\* first\\.\n\n*next: into refund, line 11*")
})

test("a high flag shows under the narration; a lesser one beside where next goes", () => {
  const high = stepWith([], toRefund, { summary: "s", flag: { severity: "high", note: "fixed" } })
  const medium = stepWith([], toRefund, { summary: "s", flag: { severity: "medium", note: "x" } })

  expect(panelBody(high)).toBe("s\n\n⚠ fixed\n\n*next: into refund, line 11*")
  expect(panelBody(medium)).toBe("s\n\n*● risky  ·  next: into refund, line 11*")
})

test("next names where it goes: a hop into another repo names the repo", () => {
  const hop: NextStop = { how: "hop", to: { ...ref, repo: "api", name: "POST /refunds" }, line: 3 }

  expect(whereNext(stepWith([], hop))).toBe("next: ↯ api: POST /refunds")
  expect(whereNext(stepWith([], { how: "end", to: null, line: null }))).toBe(
    "next: the end of the tour",
  )
})

test("the header carries the stop and the tags a reader should know", () => {
  const view = stepWith([], toRefund, { changed: false, tour_copy: true, number: 2, count: 5 })

  expect(panelLabel(view, false)).toBe("stop 2 of 5 · existing code · tour's version")
  expect(panelLabel({ ...view, changed: true }, true)).toBe(
    "stop 2 of 5 · new file · tour's version",
  )
})

test("a file is new when the change adds every line of it", () => {
  const added = [1, 2, 3].map((line) => ({ line, change: "added" as const }))
  const view = stepWith([], toRefund, { changed_lines: added })

  expect(isNewFile(view, 3)).toBe(true)
  expect(isNewFile(view, 4)).toBe(false)
})
