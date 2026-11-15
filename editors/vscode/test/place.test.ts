import { expect, test } from "bun:test"
import { lineAbove } from "../src/place"

test("the actions sit on the line above the step", () => {
  expect(lineAbove({ path: "a.ts", first: 12, last: 20 })).toBe(11)
})

test("on a file's first line the actions sit on the step's first line", () => {
  expect(lineAbove({ path: "a.ts", first: 0, last: 4 })).toBe(0)
})
