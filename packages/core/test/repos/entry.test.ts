import { describe, expect, test } from "bun:test"
import { findRepoEntry, isRemote, parseRepoEntry, parseReposList, repoName } from "../../src"

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

  test('reads a name given before "="', () => {
    expect(parseRepoEntry("payments = ../payments-service@v2.3")).toEqual({
      name: "payments",
      source: "../payments-service",
      revision: "v2.3",
    })
    expect(parseRepoEntry("auth=git@host:org/auth.git")).toEqual({
      name: "auth",
      source: "git@host:org/auth.git",
    })
  })
})

describe("repoName", () => {
  test("is the given name, else the folder without .git", () => {
    expect(repoName({ name: "payments", source: "../payments-service" })).toBe("payments")
    expect(repoName({ source: "../gateway/" })).toBe("gateway")
    expect(repoName({ source: "git@host:org/auth.git" })).toBe("auth")
  })
})

describe("findRepoEntry", () => {
  test("finds the repo a call names", () => {
    const entries = parseReposList("payments = ../payments-service\n../gateway\n")
    expect(findRepoEntry(entries, "payments")).toEqual({
      name: "payments",
      source: "../payments-service",
    })
    expect(findRepoEntry(entries, "gateway")).toEqual({ source: "../gateway" })
    expect(findRepoEntry(entries, "billing")).toBeUndefined()
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
