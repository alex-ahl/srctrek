import { describe, expect, test } from "bun:test"
import { realpath } from "node:fs/promises"
import { join } from "node:path"
import { ErrorCode, PROTOCOL_VERSION } from "@srctrek/core"
import { changeOf, makeBranchRepo, saveTrekOf } from "../../core/test/support/branch"
import { type ServeState, answerRequest, newServeState } from "../src/requests"

const client = { name: "test", version: "0" }

// A repo on a feature branch with its one-step trek saved as "refunds", and trek serve's
// state there once initialized.
async function initialized(): Promise<{ dir: string; state: ServeState }> {
  const dir = await makeBranchRepo()
  await saveTrekOf(dir, await changeOf(dir), "refunds")
  const params = { protocol_version: PROTOCOL_VERSION, client }
  const { state } = await answerRequest(newServeState(dir), "initialize", params)

  return { dir, state }
}

function errorCode(answer: { result: unknown } | { error: { code: number } }): number | undefined {
  return "error" in answer ? answer.error.code : undefined
}

describe("answering requests", () => {
  test("answers initialize with the versions, and refuses another protocol version", async () => {
    const fresh = newServeState("/nowhere")
    const ok = await answerRequest(fresh, "initialize", {
      protocol_version: PROTOCOL_VERSION,
      client,
    })
    const old = await answerRequest(fresh, "initialize", { protocol_version: 0, client })

    expect(ok.answer).toEqual({
      result: { protocol_version: PROTOCOL_VERSION, srctrek_version: "0.0.0" },
    })
    expect(errorCode(old.answer)).toBe(ErrorCode.versionMismatch)
    expect(old.state.initialized).toBe(false)
  })

  test("refuses everything but initialize until it's done", async () => {
    const { answer } = await answerRequest(newServeState("/nowhere"), "next", undefined)

    expect(errorCode(answer)).toBe(ErrorCode.notInitialized)
  })

  test("refuses unknown methods and params that don't fit", async () => {
    const { state } = await initialized()

    expect(errorCode((await answerRequest(state, "continue", {})).answer)).toBe(-32601)
    expect(errorCode((await answerRequest(state, "goto", {})).answer)).toBe(-32602)
  })

  test("refuses moves before a trek is open, and treks that aren't saved", async () => {
    const { state } = await initialized()

    expect(errorCode((await answerRequest(state, "next", undefined)).answer)).toBe(ErrorCode.noTrek)
    expect(errorCode((await answerRequest(state, "open", { trek: "nope" })).answer)).toBe(
      ErrorCode.noTrek,
    )
  })

  test("opens a trek at its overview, then steps to its first step in the repo's checkout", async () => {
    const { dir, state } = await initialized()

    const opened = await answerRequest(state, "open", { trek: "refunds" })
    const first = await answerRequest(opened.state, "next", undefined)

    expect(opened.answer).toMatchObject({ result: { kind: "overview", count: 1 } })
    expect(first.answer).toMatchObject({
      result: { kind: "step", id: "s1", path: join(await realpath(dir), "app.ts") },
    })
  })

  test("refuses a step the trek doesn't have, and stays where it was", async () => {
    const { state } = await initialized()
    const opened = await answerRequest(state, "open", { trek: "refunds" })

    const missing = await answerRequest(opened.state, "goto", { step: "s9" })

    expect(errorCode(missing.answer)).toBe(ErrorCode.unknownStep)
    expect(missing.state).toBe(opened.state)
  })
})
