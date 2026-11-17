import { describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { buildDraftSteps, buildFiles } from "../../../src/index"
import { makeRepo } from "@srctrek/testing"

const step = {
  id: "s1",
  repo: "web",
  kind: "call" as const,
  summary: "The button posts",
  flag: "high" as const,
}

describe("a build's draft", () => {
  test("is read as its steps, as trek mcp writes it beside the build's log", async () => {
    const dir = await makeRepo()
    const files = await buildFiles(dir, "refunds")
    await mkdir(files.dir, { recursive: true })

    await writeFile(files.draft, JSON.stringify({ title: "Refunds", steps: [step] }))

    expect(await buildDraftSteps(dir, "refunds")).toEqual([step])
  })

  test("is none while it's missing, or cut short as it's written", async () => {
    const dir = await makeRepo()
    const files = await buildFiles(dir, "refunds")
    await mkdir(files.dir, { recursive: true })
    expect(await buildDraftSteps(dir, "refunds")).toEqual([])

    await writeFile(files.draft, '{"title": "Refunds", "ste')
    expect(await buildDraftSteps(dir, "refunds")).toEqual([])
  })
})
