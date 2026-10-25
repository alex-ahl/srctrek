import { describe, expect, test } from "bun:test"
import { isRemote, parseRepoEntry, parseReposList } from "../../src"

describe("parseRepoEntry", () => {
  test("reads a path, with or without a pinned revision", () => {
    expect(parseRepoEntry("../gateway")).toEqual({ source: "../gateway" })
    expect(parseRepoEntry("../payments@v2.3")).toEqual({ source: "../payments", revision: "v2.3" })
  })

  test("doesn't read the user part of an SSH URL as a revision", () => {
    expect(parseRepoEntry("git@host:org/auth.git")).toEqual({ source: "git@host:org/auth.git" })
    expect(parseRepoEntry("git@host:org/auth.git@main")).toEqual({
      source: "git@host:org/auth.git",
      revision: "main",
    })
  })
})

describe("isRemote", () => {
  test("tells URLs from local paths", () => {
    expect(isRemote("https://host/org/auth.git")).toBe(true)
    expect(isRemote("git@host:org/auth.git")).toBe(true)
    expect(isRemote("../gateway")).toBe(false)
    expect(isRemote("/srv/repos/gateway")).toBe(false)
  })
})

describe("parseReposList", () => {
  test("takes one entry per line, skipping blanks and comments", () => {
    const text = "# repos on the route\n../gateway\n\n../payments@v2.3  # pinned\n"
    expect(parseReposList(text)).toEqual([
      { source: "../gateway" },
      { source: "../payments", revision: "v2.3" },
    ])
  })
})
