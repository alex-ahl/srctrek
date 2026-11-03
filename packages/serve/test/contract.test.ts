import { afterEach, describe, expect, test } from "bun:test"
import { realpath } from "node:fs/promises"
import { join } from "node:path"
import {
  ErrorCode,
  PROTOCOL_VERSION,
  type SubmittedStep,
  addSteps,
  draftToTour,
  newDraft,
  runGit,
  saveTour,
} from "@codetrail/core"
import { changeOf } from "../../core/test/support/branch"
import { commit, makeRepo } from "../../core/test/support/repo"
import { tempDir } from "../../core/test/support/temp"
import { ServeTestClient } from "./serve-client"

const header = {
  title: "Pay",
  overview: "main pays through a helper.",
  trigger: { kind: "command" as const, input: "run main" },
  outcome: "paid",
  sources: [],
  author: { model: "m" },
}

// A repo on branch feature whose change adds main.ts, which calls pay in pay.ts and carries on,
// with the tour of it saved as "pay": main (s1) calls pay (s2), which returns to main (s3).
async function repoWithTour(): Promise<string> {
  const dir = await makeRepo()
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  await commit(dir, "pay.ts", "export function pay() {\n  return 250\n}\n")
  await commit(dir, "main.ts", "const total = pay()\nconsole.log(total)\n")

  const change = await changeOf(dir)
  const repo = change.repos[0]?.name ?? ""
  const step = (fields: Partial<SubmittedStep>): SubmittedStep => ({
    id: "s1",
    repo,
    file: "main.ts",
    start_line: 1,
    end_line: 1,
    kind: "call",
    summary: "s",
    details: "d",
    via: null,
    ...fields,
  })
  const cites = (file: string, line: number) => ({ cites: [{ repo, file, line }], guessed: false })
  const steps = [
    step({ summary: "main calls pay" }),
    step({ id: "s2", file: "pay.ts", end_line: 3, from: "s1", via: cites("main.ts", 1) }),
    step({
      id: "s3",
      start_line: 2,
      end_line: 2,
      kind: "return",
      from: "s2",
      via: cites("pay.ts", 2),
    }),
  ]

  const { draft, problems } = await addSteps(newDraft(change, header), steps)
  expect(problems).toEqual([])
  await saveTour(dir, "pay", draftToTour(draft))

  return dir
}

let client: ServeTestClient | undefined

afterEach(() => client?.close())

// trail serve in `dir`, its checkouts cached in a folder of its own, initialized.
async function serving(dir: string): Promise<ServeTestClient> {
  client = new ServeTestClient(dir, { XDG_CACHE_HOME: await tempDir("cache-") })
  await client.initialize()
  return client
}

describe("trail serve, as an editor sees it", () => {
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

  test("marks steps stale against the change as it is now, from trail's arguments", async () => {
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
