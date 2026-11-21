import { expect, test } from "bun:test"
import type { RouteStop } from "../../src/stepping/route"
import { WHOLE, narrowText, shownOf } from "../../src/stepping/route-narrow"

const stop = (id: string, depth: number, more: Partial<RouteStop> = {}): RouteStop => ({
  id,
  number: Number(id.slice(1)),
  depth,
  kind: "call",
  from: undefined,
  hop: false,
  through: undefined,
  repo: "api",
  repoChange: undefined,
  name: id,
  file: "main.ts",
  line: 1,
  summary: "",
  values: [],
  changed: false,
  flag: undefined,
  visited: false,
  ...more,
})

const route = [
  stop("s1", 0),
  stop("s2", 1, { changed: true, name: "readBuild" }),
  stop("s3", 2, { flag: { severity: "high", note: "off by one" } }),
  stop("s4", 0, { changed: true }),
]

test("shows every stop no folded call hides, until the map is narrowed", () => {
  expect(shownOf(route, new Set(), WHOLE)).toEqual([0, 1, 2, 3])
  expect(shownOf(route, new Set(["s1"]), WHOLE)).toEqual([0, 3])
})

test("narrows to changed or flagged stops, or by name, folds and all", () => {
  const folded = new Set(["s1"])

  expect(shownOf(route, folded, { ...WHOLE, only: "changed" })).toEqual([1, 3])
  expect(shownOf(route, folded, { ...WHOLE, only: "flagged" })).toEqual([2])
  expect(shownOf(route, folded, { ...WHOLE, find: "READ" })).toEqual([1])
})

test("says what the map is narrowed to, with the find's cursor while it's typed", () => {
  expect(narrowText(WHOLE, 4)).toBe("")
  expect(narrowText({ only: "changed", find: "re", finding: true }, 1)).toBe(
    'showing changed · find "re▏" · 1 found',
  )
})
