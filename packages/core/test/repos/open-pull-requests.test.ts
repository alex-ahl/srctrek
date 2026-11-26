import { describe, expect, test } from "bun:test"
import { chmod, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { openPullRequests, pullRequestOf } from "../../src"
import { rejection } from "../support/rejection"
import { tempDir } from "@srctrek/testing"

const LISTED = [
  {
    number: 14,
    title: "Round refunds to cents",
    author: { login: "bo" },
    url: "https://github.com/acme/api/pull/14",
    isDraft: true,
    headRefOid: "b14",
    headRefName: "fix/rounding",
    isCrossRepository: false,
    baseRefName: "main",
    updatedAt: "2026-11-20T10:00:00Z",
    commits: { totalCount: 2 },
  },
  {
    number: 12,
    title: "Add partial refunds",
    author: { login: "alice" },
    url: "https://github.com/acme/api/pull/12",
    isDraft: false,
    headRefOid: "a12",
    headRefName: "partial-refunds",
    isCrossRepository: false,
    baseRefName: "release/2.1",
    updatedAt: "2026-11-22T09:00:00Z",
    commits: { totalCount: 3 },
  },
]

// A stand-in gh, running `script`.
async function fakeGh(script: string): Promise<string> {
  const path = join(await tempDir("gh-"), "gh")
  await writeFile(path, `#!/bin/sh\n${script}\n`)
  await chmod(path, 0o755)
  return path
}

type Lists = Readonly<{ listed?: unknown[]; requested?: unknown[]; own?: unknown[] }>

// A stand-in gh for acme/api, answering the query with the open pull requests, those waiting on
// the user's review, and the user's own; each call it gets is written to `calls` beside it.
async function ghListing({ listed = [], requested = [], own = [] }: Lists) {
  const answer = {
    data: {
      repository: { pullRequests: { nodes: listed } },
      requested: { nodes: requested },
      own: { nodes: own },
    },
  }
  const gh = await fakeGh(`printf '%s\\n' "$*" >> "$(dirname "$0")/calls"
case "$*" in
  *"repo view"*) echo '{"nameWithOwner":"acme/api"}' ;;
  *) echo '${JSON.stringify(answer)}' ;;
esac`)
  // every call, the query spread over its lines among them
  const calls = () => readFile(join(dirname(gh), "calls"), "utf8")
  return { gh, calls }
}

describe("openPullRequests", () => {
  test("lists the open pull requests with their heads, bases, commits, and last updates, those waiting on the user's review first", async () => {
    const { gh } = await ghListing({ listed: LISTED, requested: [LISTED[1]] })

    const open = await openPullRequests(await tempDir("repo-"), gh)

    expect(open).toEqual([
      {
        number: 12,
        title: "Add partial refunds",
        author: "alice",
        url: "https://github.com/acme/api/pull/12",
        draft: false,
        reviewRequested: true,
        mine: false,
        head: "a12",
        branch: "partial-refunds",
        base: "release/2.1",
        updatedAt: "2026-11-22T09:00:00Z",
        commits: 3,
      },
      {
        number: 14,
        title: "Round refunds to cents",
        author: "bo",
        url: "https://github.com/acme/api/pull/14",
        draft: true,
        reviewRequested: false,
        mine: false,
        head: "b14",
        branch: "fix/rounding",
        base: "main",
        updatedAt: "2026-11-20T10:00:00Z",
        commits: 2,
      },
    ])
  })

  test("lists a pull request waiting on the user's review that's older than the rest listed", async () => {
    const older = { ...LISTED[0], number: 3, isDraft: false, updatedAt: "2026-09-01T10:00:00Z" }
    const { gh } = await ghListing({ listed: LISTED, requested: [older] })

    const open = await openPullRequests(await tempDir("repo-"), gh)

    expect(open.map((pr) => [pr.number, pr.reviewRequested])).toEqual([
      [3, true],
      [14, false],
      [12, false],
    ])
  })

  test("lists the user's own pull requests after those waiting on them, however old", async () => {
    const own = { ...LISTED[0], number: 5, isDraft: false, updatedAt: "2026-08-01T10:00:00Z" }
    const { gh } = await ghListing({ listed: LISTED, own: [own] })

    const open = await openPullRequests(await tempDir("repo-"), gh)

    expect(open.map((pr) => [pr.number, pr.mine])).toEqual([
      [5, true],
      [14, false],
      [12, false],
    ])
  })

  test("a fork's pull request names no branch: the repo has none of that name", async () => {
    const { gh } = await ghListing({ listed: [{ ...LISTED[0], isCrossRepository: true }] })

    const [pull] = await openPullRequests(await tempDir("repo-"), gh)

    expect(pull?.branch).toBeUndefined()
  })

  // GitHub prices a query by the lists it may have to fetch: the commits themselves, each with
  // its authors, cost a hundred times what their count does.
  test("asks for the three lists in one query, each pull request's commits by their count", async () => {
    const { gh, calls } = await ghListing({ listed: LISTED })

    await openPullRequests(await tempDir("repo-"), gh)

    const called = await calls()
    expect(called.split("api graphql")).toHaveLength(2)
    expect(called).toContain("commits { totalCount }")
    expect(called).not.toContain("commits(")
    expect(called).toContain("repo:acme/api is:pr is:open review-requested:@me")
  })

  test("names the repo once, however often its pull requests are read again", async () => {
    const { gh, calls } = await ghListing({ listed: LISTED })
    const repo = await tempDir("repo-")

    await openPullRequests(repo, gh)
    await openPullRequests(repo, gh)

    expect((await calls()).split("repo view")).toHaveLength(2)
  })

  test("says what gh said when it can't list them", async () => {
    const gh = await fakeGh(
      `echo "To get started with GitHub CLI, please run:  gh auth login" >&2; exit 4`,
    )

    const error = await rejection(openPullRequests(await tempDir("repo-"), gh))

    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain(
      "gh: To get started with GitHub CLI, please run:  gh auth login",
    )
  })
})

describe("pullRequestOf", () => {
  test("is the pull request at a link: its title, who opened it, and whether it's a draft", async () => {
    const gh = await fakeGh(
      `echo '{"title":"Add partial refunds","author":{"login":"alice"},"isDraft":true}'`,
    )

    const pull = await pullRequestOf(
      await tempDir("repo-"),
      "https://github.com/acme/api/pull/12",
      gh,
    )

    expect(pull).toEqual({ title: "Add partial refunds", author: "alice", draft: true })
  })
})
