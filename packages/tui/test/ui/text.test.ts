import { expect, test } from "bun:test"
import { fitPath, wrap } from "../../src/ui/text"

test("wraps text at spaces into lines no wider than asked", () => {
  expect(wrap("the command that runs your agent headless", 16)).toEqual([
    "the command that",
    "runs your agent",
    "headless",
  ])
})

test("cuts a path by dropping folders from its start, so the file and its folder show", () => {
  const path = "packages/tui/src/home/row-actions.ts:107"

  expect(fitPath(path, 40)).toBe(path)
  expect(fitPath(path, 26)).toBe("…/home/row-actions.ts:107")
  expect(fitPath(path, 8)).toBe("….ts:107")
})
