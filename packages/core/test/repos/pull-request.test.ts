import { describe, expect, test } from "bun:test"
import { parsePullRequestUrl } from "../../src"

describe("parsePullRequestUrl", () => {
  test("reads a GitHub pull request, on any host", () => {
    expect(parsePullRequestUrl("https://github.com/acme/payments/pull/12")).toEqual({
      url: "https://github.com/acme/payments/pull/12",
      name: "payments",
      cloneUrl: "https://github.com/acme/payments.git",
      number: 12,
      ref: "refs/pull/12/head",
    })
    expect(parsePullRequestUrl("https://git.acme.test/acme/payments/pull/7/files")).toMatchObject({
      cloneUrl: "https://git.acme.test/acme/payments.git",
      ref: "refs/pull/7/head",
    })
  })

  test("reads a GitLab merge request, nested groups included", () => {
    const url = "https://gitlab.com/acme/billing/payments/-/merge_requests/45/diffs"
    expect(parsePullRequestUrl(url)).toMatchObject({
      name: "payments",
      cloneUrl: "https://gitlab.com/acme/billing/payments.git",
      number: 45,
      ref: "refs/merge-requests/45/head",
    })
  })

  test("leaves anything else alone", () => {
    expect(parsePullRequestUrl("https://github.com/acme/payments")).toBeUndefined()
    expect(parsePullRequestUrl("https://github.com/acme/payments/pull/new")).toBeUndefined()
    expect(parsePullRequestUrl("https://github.com/pull/12")).toBeUndefined()
    expect(parsePullRequestUrl("../payments")).toBeUndefined()
    expect(parsePullRequestUrl("main...feature")).toBeUndefined()
  })
})
