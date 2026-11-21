import { expect, test } from "bun:test"
import type { NextStop } from "@srctrek/core"
import { sameView } from "../src/moves"
import { stepWith } from "./support/views"

const toPay: NextStop = { how: "into", to: null, line: 1, through: null, text: "next: into pay" }

test("a move answered with the step it started on went nowhere", () => {
  const view = stepWith([], toPay)

  expect(sameView(view, view)).toBe(true)
  expect(sameView(view, { ...view, id: "s2" })).toBe(false)
})
