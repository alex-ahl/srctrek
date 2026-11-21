import { expect, test } from "bun:test"
import type { RouteStop } from "../../src/stepping/route"
import { filesOf, stopFor } from "../../src/stepping/route-files"

const stop = (n: number, repo: string, file: string, visited = false): RouteStop => ({
  id: `s${String(n)}`,
  number: n,
  depth: 0,
  kind: "call",
  from: undefined,
  hop: false,
  through: undefined,
  repo,
  repoChange: undefined,
  name: `s${String(n)}`,
  file,
  line: 1,
  summary: "",
  values: [],
  changed: false,
  flag: undefined,
  visited,
})

const route = [
  stop(1, "api", "src/web/main.ts", true),
  stop(2, "api", "src/pay/pay.ts", true),
  stop(3, "billing", "gateway.ts"),
  stop(4, "api", "src/web/main.ts"),
  stop(5, "api", "src/pay/pay.ts"),
]

test("lists the files by repo as the trek reaches them, then by folder, each with its stops", () => {
  const files = filesOf(route, [0, 1, 2, 3, 4])

  expect(files.map((file) => [file.repo, file.dir, file.name, file.stops])).toEqual([
    ["api", "src/pay/", "pay.ts", [1, 4]],
    ["api", "src/web/", "main.ts", [0, 3]],
    ["billing", "", "gateway.ts", [2]],
  ])
})

test("a file stands for the stop the trek is on in it, else its first not yet stepped to", () => {
  const [pay] = filesOf(route, [0, 1, 2, 3, 4])
  if (pay === undefined) {
    throw new Error("no file")
  }

  expect(stopFor(route, pay, 1)).toBe(1)
  expect(stopFor(route, pay, 0)).toBe(4)
})
