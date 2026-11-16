import { expect, test } from "bun:test"
import type { NextStop } from "@srctrek/core"
import { changedLinesShown } from "../../src/code/changed-lines"
import { stepWith } from "../support/views"

const toPay: NextStop = { how: "into", to: null, line: 1, text: "next: into pay" }

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
