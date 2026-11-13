import { expect, test } from "bun:test"
import { rangeCommits, recordedRange } from "../../src/schema/recorded-range"

test("a recorded range reads back as the commits it was written from", () => {
  expect(rangeCommits(recordedRange("9c1e2f3", "1a2b3c4"))).toEqual({
    base: "9c1e2f3",
    head: "1a2b3c4",
  })
})

test("no range, or text that isn't one, reads as none", () => {
  expect(rangeCommits(undefined)).toBeUndefined()
  expect(rangeCommits("9c1e2f3")).toBeUndefined()
})
