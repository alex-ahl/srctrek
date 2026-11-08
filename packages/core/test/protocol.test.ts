import { describe, expect, test } from "bun:test"
import { PROTOCOL_VERSION, RequestParams, isMethod, versionMismatch } from "../src"

describe("the editor protocol's requests", () => {
  test("knows its methods, and nothing else", () => {
    expect(isMethod("open")).toBe(true)
    expect(isMethod("over")).toBe(true)
    expect(isMethod("continue")).toBe(false)
    expect(isMethod("toString")).toBe(false)
  })

  test("takes a trek by name, with trek's arguments for the change as it is now", () => {
    expect(RequestParams.open.safeParse({ trek: "feature-refunds" }).success).toBe(true)
    expect(RequestParams.open.safeParse({ trek: "pr-12", args: ["main...feature"] }).success).toBe(
      true,
    )
    expect(RequestParams.open.safeParse({ trek: "" }).success).toBe(false)
  })

  test("takes moves without params, and into with an optional target", () => {
    expect(RequestParams.next.safeParse(undefined).success).toBe(true)
    expect(RequestParams.next.safeParse({ step: "s2" }).success).toBe(false)
    expect(RequestParams.into.safeParse({ target: "s11" }).success).toBe(true)
    expect(RequestParams.into.safeParse({}).success).toBe(true)
    expect(RequestParams.goto.safeParse({}).success).toBe(false)
  })

  test("says which side to update when the versions differ", () => {
    expect(versionMismatch(PROTOCOL_VERSION - 1)).toContain("update the editor plugin")
    expect(versionMismatch(PROTOCOL_VERSION + 1)).toContain("update trek")
  })
})
