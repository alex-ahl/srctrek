import { expect, test } from "bun:test"
import { atStop, movedPlace, windowOf } from "../../src/stepping/lines"

// A step starting on line 40 of a file 100 lines long, 17 of which fit below its band.
const { layout } = windowOf({ start_line: 40 }, 100, 20, 3)

test("shows the step near the top, a few lines above it", () => {
  expect(windowOf({ start_line: 40 }, 100, 20, 3)).toMatchObject({ first: 37, last: 53 })
})

test("opens with the cursor on the stop's first line", () => {
  expect(atStop(layout)).toEqual({ cursor: 40, top: 37 })
})

test("moves the cursor without moving the view, until it nears the view's edge", () => {
  expect(movedPlace(atStop(layout), 5, layout)).toEqual({ cursor: 45, top: 37 })
  expect(movedPlace(atStop(layout), 12, layout)).toEqual({ cursor: 52, top: 39 })
  expect(movedPlace(atStop(layout), -5, layout)).toEqual({ cursor: 35, top: 32 })
})

test("keeps the cursor and the view within the file", () => {
  expect(movedPlace(atStop(layout), -100, layout)).toEqual({ cursor: 1, top: 1 })
  expect(movedPlace(atStop(layout), 100, layout)).toEqual({ cursor: 100, top: 84 })
})
