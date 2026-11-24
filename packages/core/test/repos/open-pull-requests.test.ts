import { describe, expect, test } from "bun:test"
import { chmod, writeFile } from "node:fs/promises"
import { join } from "node:path"
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
    baseRefName: "main",
    updatedAt: "2026-11-20T10:00:00Z",
    commits: [{ oid: "c1" }, { oid: "c2" }],
  },
  {
    number: 12,
    title: "Add partial refunds",
    author: { login: "alice" },
    url: "https://github.com/acme/api/pull/12",
    isDraft: false,
    headRefOid: "a12",
    baseRefName: "release/2.1",
    updatedAt: "2026-11-22T09:00:00Z",
    commits: [{ oid: "c3" }, { oid: "c4" }, { oid: "c5" }],
  },
]

// A stand-in gh: the review search answers with what waits on the user, the plain list with all.
async function fakeGh(script: string): Promise<string> {
  const path = join(await tempDir("gh-"), "gh")
  await writeFile(path, `#!/bin/sh\n${script}\n`)
  await chmod(path, 0o755)
  return path
}

describe("openPullRequests", () => {
  test("lists the open pull requests with their heads, bases, commits, and last updates, those waiting on the user's review first", async () => {
    const gh = await fakeGh(`case "$*" in
  *review-requested*) echo '[{"number":12}]' ;;
  *) echo '${JSON.stringify(LISTED)}' ;;
esac`)

    const open = await openPullRequests(await tempDir("repo-"), gh)

    expect(open).toEqual([
      {
        number: 12,
        title: "Add partial refunds",
        author: "alice",
        url: "https://github.com/acme/api/pull/12",
        draft: false,
        reviewRequested: true,
        head: "a12",
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
        head: "b14",
        base: "main",
        updatedAt: "2026-11-20T10:00:00Z",
        commits: 2,
      },
    ])
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
