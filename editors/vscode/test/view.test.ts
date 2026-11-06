import { expect, test } from "bun:test"
import { narrationLine } from "../src/view"

test("the narration hangs below the line above the step", () => {
  expect(narrationLine({ path: "a.ts", first: 12, last: 20 })).toBe(11)
})

test("on a file's first line the narration hangs below the step's first line", () => {
  expect(narrationLine({ path: "a.ts", first: 0, last: 4 })).toBe(0)
})
