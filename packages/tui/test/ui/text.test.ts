import { expect, test } from "bun:test"
import { wrap } from "../../src/ui/text"

test("wraps text at spaces into lines no wider than asked", () => {
  expect(wrap("the command that runs your agent headless", 16)).toEqual([
    "the command that",
    "runs your agent",
    "headless",
  ])
})
