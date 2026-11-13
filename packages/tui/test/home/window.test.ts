import { expect, test } from "bun:test"
import { visibleWindow } from "../../src/home/window"

test("shows everything when everything fits", () => {
  expect(visibleWindow(4, 3, 10)).toEqual({ start: 0, end: 4 })
})

test("keeps the selection in view, centred where it can be", () => {
  expect(visibleWindow(24, 0, 5)).toEqual({ start: 0, end: 5 })
  expect(visibleWindow(24, 12, 5)).toEqual({ start: 10, end: 15 })
  expect(visibleWindow(24, 23, 5)).toEqual({ start: 19, end: 24 })
})
