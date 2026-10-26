import { describe, expect, test } from "bun:test"
import { readChangeArguments } from "../../src"

const FOLDERS = new Set(["../gateway", "../api", "../web", "gateway"])
const read = (...args: string[]) => readChangeArguments(args, (path) => FOLDERS.has(path))
const current = { source: "." }

describe("readChangeArguments", () => {
  test("no arguments: the current repo's branch since it left the base branch", () => {
    expect(read()).toEqual({
      changes: [
        {
          kind: "range",
          repo: current,
          range: { base: undefined, head: "HEAD", mode: "since-branch-point" },
        },
      ],
      unchanged: [],
    })
  })

  test("a range first applies to the current repo; a repo after it is on the route", () => {
    const { changes, unchanged } = read("main...feature", "../gateway")

    expect(changes).toMatchObject([{ kind: "range", repo: current, range: { base: "main" } }])
    expect(unchanged).toEqual([{ source: "../gateway" }])
  })

  test("a range applies to the repo just before it", () => {
    const { changes, unchanged } = read("../api", "main...feature", "../web", "main..feature")

    expect(changes).toMatchObject([
      { repo: { source: "../api" }, range: { mode: "since-branch-point" } },
      { repo: { source: "../web" }, range: { mode: "direct" } },
    ])
    expect(unchanged).toEqual([])
  })

  test("a pull request is a change of its own; repos around it stay unchanged", () => {
    const url = "https://github.com/acme/pay/pull/12"
    const { changes, unchanged } = read(url, "gateway@v2", "git@host:acme/auth.git")

    expect(changes).toMatchObject([{ kind: "pull-request", pr: { number: 12 } }])
    expect(unchanged).toEqual([
      { source: "gateway", revision: "v2" },
      { source: "git@host:acme/auth.git" },
    ])
  })

  test("a bare word is a repo only when that folder exists", () => {
    expect(read("gateway").unchanged).toEqual([{ source: "gateway" }])
    expect(read("feature").changes).toMatchObject([{ repo: current, range: { head: "feature" } }])
  })

  test("says what's wrong with arguments it can't use", () => {
    expect(() => read("../gatewya")).toThrow("no repo at ../gatewya")
    expect(() => read("main...a", "main...b")).toThrow("a range must follow a repo: main...b")
    expect(() => read("https://github.com/acme/pay/pull/12", "main...b")).toThrow(
      "a range must follow a repo: main...b",
    )
    expect(() => read("../api@v1", "main...b")).toThrow(
      "../api@v1 is pinned, so it can't take a range: main...b",
    )
    expect(() => read("https://bitbucket.org/acme/pay/pull-requests/7")).toThrow(
      "can't fetch this pull request: give its repo and a range instead",
    )
  })
})
