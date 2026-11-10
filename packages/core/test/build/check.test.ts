import { describe, expect, test } from "bun:test"
import { checkAgent } from "../../src"

describe("checkAgent", () => {
  test("works when the command starts and exits cleanly, with the instruction as its last argument", async () => {
    expect(await checkAgent("test -n")).toEqual({ ok: true })
  })

  test("says what a failing command printed last", async () => {
    expect(await checkAgent("echo 'not logged in' >&2; false")).toEqual({
      ok: false,
      problem: "not logged in",
    })
  })

  test("says when a command doesn't answer in time", async () => {
    expect(await checkAgent("sleep 5; true", 100)).toEqual({
      ok: false,
      problem: "it didn't answer in time",
    })
  })
})
