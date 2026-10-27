import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildState, startBuild, tourStatus } from "../../src"
import { changeOf, makeBranchRepo, saveTourOf } from "../support/branch"

async function untilEnded(root: string, name: string): Promise<void> {
  for (let tries = 0; tries < 100 && (await buildState(root, name)) === "building"; tries++) {
    await Bun.sleep(50)
  }
}

describe("tourStatus", () => {
  test("is missing before any build, under the name a new tour would get", async () => {
    const dir = await makeBranchRepo()

    expect(await tourStatus(dir, await changeOf(dir))).toEqual({
      kind: "missing",
      name: "feature-refunds",
    })
  })

  test("is ready once a tour of the change is saved, whatever its name", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTourOf(dir, change, "my-refunds")

    expect(await tourStatus(dir, change)).toEqual({ kind: "ready", name: "my-refunds" })
  })

  test("is ready again for the same uncommitted work", async () => {
    const dir = await makeBranchRepo()
    await writeFile(join(dir, "app.ts"), "const total = 300\n")
    await saveTourOf(dir, await changeOf(dir, "", true), "work-in-progress")

    expect(await tourStatus(dir, await changeOf(dir, "", true))).toEqual({
      kind: "ready",
      name: "work-in-progress",
    })
  })

  test("is building while the agent works, and failed with the log's end when it fails", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await startBuild(dir, [], "feature-refunds", "sleep 0.3; echo 'cannot reach the server'; false")

    expect(await tourStatus(dir, change)).toEqual({ kind: "building", name: "feature-refunds" })
    await untilEnded(dir, "feature-refunds")
    expect(await tourStatus(dir, change)).toEqual({
      kind: "failed",
      name: "feature-refunds",
      logTail: ["cannot reach the server"],
    })
  })
})
