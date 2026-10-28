import { expect, test } from "bun:test"
import { wordsOf } from "../src/words"

test("splits a change into words as a shell would, keeping quoted parts together", () => {
  expect(wordsOf("../api  main...feature")).toEqual(["../api", "main...feature"])
  expect(wordsOf('--code="a refund request" ../api')).toEqual(["--code=a refund request", "../api"])
  expect(wordsOf(undefined)).toEqual([])
})
