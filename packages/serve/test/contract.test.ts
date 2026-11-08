import { afterEach, describe, expect, test } from "bun:test"
import { realpath } from "node:fs/promises"
import { join } from "node:path"
import { ErrorCode, PROTOCOL_VERSION, runGit } from "@srctrek/core"
import { commit, makeRepo } from "../../core/test/support/repo"
import { tempDir } from "../../core/test/support/temp"
import { ServeTestClient } from "./serve-client"
import { repoWithTour } from "./support/pay-tour"

let client: ServeTestClient | undefined

afterEach(() => client?.close())

// trek serve in `dir`, its checkouts cached in a folder of its own, initialized.
async function serving(dir: string): Promise<ServeTestClient> {
  client = new ServeTestClient(dir, { XDG_CACHE_HOME: await tempDir("cache-") })
  await client.initialize()
  return client
}

describe("trek serve, as an editor sees it", () => {
  test("answers the handshake with both versions, and refuses another protocol version", async () => {
    client = new ServeTestClient(await tempDir("serve-"))

    expect(
      await client.errorCode("initialize", {
        protocol_version: PROTOCOL_VERSION + 1,
        client: { name: "old", version: "0" },
      }),
    ).toBe(ErrorCode.versionMismatch)
    expect(await client.initialize()).toEqual({
      protocol_version: PROTOCOL_VERSION,
      trail_version: "0.0.0",
    })
  })

  test("steps through a tour: overview, each step in its checkout, then the end", async () => {
    const dir = await repoWithTour()
    const serve = await serving(dir)

    expect(await serve.request("open", { tour: "pay" })).toMatchObject({
      kind: "overview",
      count: 3,
    })
    expect(await serve.request("next")).toMatchObject({
      kind: "step",
      id: "s1",
      path: join(await realpath(dir), "main.ts"),
      number: 1,
    })
    expect(await serve.request("goto", { step: "s3" })).toMatchObject({ id: "s3" })
    expect(await serve.request("next")).toMatchObject({ kind: "end", outcome: "paid" })
    expect(await serve.request("prev")).toMatchObject({ id: "s3" })
  })

  test("steps into a call, over it, and out of it by the call stack", async () => {
    const serve = await serving(await repoWithTour())
    await serve.request("open", { tour: "pay" })
    await serve.request("goto", { step: "s1" })

    const into = await serve.request("into")
    expect(into).toMatchObject({ id: "s2", stack: [{ id: "s1" }, { id: "s2" }] })
    expect(await serve.request("out")).toMatchObject({ id: "s3" })
    await serve.request("goto", { step: "s1" })
    expect(await serve.request("over")).toMatchObject({ id: "s3" })
  })

  test("answers requests sent together in the order they were sent", async () => {
    const serve = await serving(await repoWithTour())

    // open reads git, so the moves sent right behind it arrive while it's still working
    const views = await Promise.all([
      serve.request("open", { tour: "pay" }),
      serve.request("next"),
      serve.request("next"),
    ])

    expect(views).toMatchObject([{ kind: "overview" }, { id: "s1" }, { id: "s2" }])
  })

  test("refuses what it can't do with the protocol's codes, keeping its place", async () => {
    const serve = await serving(await repoWithTour())

    expect(await serve.errorCode("next")).toBe(ErrorCode.noTour)
    expect(await serve.errorCode("open", { tour: "nope" })).toBe(ErrorCode.noTour)
    await serve.request("open", { tour: "pay" })
    await serve.request("next")
    expect(await serve.errorCode("goto", { step: "s9" })).toBe(ErrorCode.unknownStep)
    expect(await serve.errorCode("goto", {})).toBe(-32602)
    expect(await serve.errorCode("continue")).toBe(-32601)
    expect(await serve.request("next")).toMatchObject({ id: "s2" })
  })

  test("refuses moves until initialized", async () => {
    client = new ServeTestClient(await tempDir("serve-"))

    expect(await client.errorCode("open", { tour: "pay" })).toBe(ErrorCode.notInitialized)
  })

  test("marks steps stale against the change as it is now, from trek's arguments", async () => {
    const dir = await repoWithTour()
    await commit(dir, "pay.ts", "export function pay() {\n  return 300\n}\n")
    const serve = await serving(dir)

    await serve.request("open", { tour: "pay", args: [] })

    expect(await serve.request("goto", { step: "s1" })).toMatchObject({ stale: false })
    expect(await serve.request("next")).toMatchObject({ id: "s2", stale: true })
  })

  test("exits when the editor closes its end", async () => {
    const serve = await serving(await tempDir("serve-"))

    serve.close()

    expect(await serve.exited).toBe(0)
  })
})

// The lines a log answer carries.
function linesOf(answer: unknown): string[] {
  const lines =
    typeof answer === "object" && answer !== null && "lines" in answer ? answer.lines : []
  return Array.isArray(lines) ? lines.filter((line) => typeof line === "string") : []
}

// A repo on branch feature with one commit and no tour of it yet.
async function repoWithoutTour(): Promise<string> {
  const dir = await makeRepo()
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  await commit(dir, "pay.ts", "export function pay() {\n  return 250\n}\n")

  return dir
}

// trek serve in `dir` with `agent` as SRCTREK_AGENT ("" for none), initialized.
async function servingWithAgent(dir: string, agent: string): Promise<ServeTestClient> {
  const cache = await tempDir("cache-")
  client = new ServeTestClient(dir, { XDG_CACHE_HOME: cache, SRCTREK_AGENT: agent })
  await client.initialize()
  return client
}

describe("trek serve, for the editor's list of tours", () => {
  test("lists the saved tours, and where the change's tour stands", async () => {
    const serve = await serving(await repoWithTour())

    const answer = await serve.request("tours")

    expect(answer).toMatchObject({
      change: { kind: "ready" },
      tours: [{ name: "pay", valid: true, title: "Pay", steps: 3 }],
    })
  })

  test("refuses to build without an agent, saying how to set one", async () => {
    const serve = await servingWithAgent(await repoWithoutTour(), "")

    expect(await serve.errorCode("build")).toBe(ErrorCode.noAgent)
  })

  test("starts the agent on the change's tour, and shows its log", async () => {
    const serve = await servingWithAgent(await repoWithoutTour(), "sleep 1 && echo working on")

    const started = await serve.request("build")
    expect(started).toMatchObject({ change: { kind: "building", name: "feature" } })

    await Bun.sleep(1500)
    const log = await serve.request("log", { tour: "feature" })
    expect(linesOf(log).join("\n")).toContain("working on")
  })

  test("refuses trek arguments it can't read", async () => {
    const serve = await serving(await repoWithTour())

    expect(await serve.errorCode("tours", { args: ["../nowhere"] })).toBe(
      ErrorCode.unreadableChange,
    )
  })
})
