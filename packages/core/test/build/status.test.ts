import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildState, resolveChange, startBuild, tourStatus } from "../../src"
import { changeOf, makeBranchRepo, saveTourOf } from "../support/branch"
import { commit } from "../support/repo"
import { makeCacheDir } from "../support/remote"

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

  test("is empty when the branch hasn't moved from where it left the base", async () => {
    const dir = await makeBranchRepo()

    expect(await tourStatus(dir, await changeOf(dir, "HEAD..HEAD"))).toEqual({
      kind: "empty",
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

    expect(await tourStatus(dir, change)).toEqual({
      kind: "building",
      name: "feature-refunds",
      logTail: [],
    })
    await untilEnded(dir, "feature-refunds")
    expect(await tourStatus(dir, change)).toEqual({
      kind: "failed",
      name: "feature-refunds",
      logTail: ["cannot reach the server"],
    })
  })

  test("is missing again when a build saved its tour and the tour was then removed", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await startBuild(
      dir,
      [],
      "feature-refunds",
      "echo 'trek: saved .srctrek/tours/feature-refunds.json'; true",
    )
    await untilEnded(dir, "feature-refunds")

    expect(await tourStatus(dir, change)).toEqual({ kind: "missing", name: "feature-refunds" })
  })

  test("a code tour is named after its trigger, found again, and stale once the code moves on", async () => {
    const dir = await makeBranchRepo()
    const codeOf = async () =>
      resolveChange(
        dir,
        {
          changes: [],
          unchanged: [{ source: "." }],
          uncommitted: false,
          code: { trigger: "a refund request" },
        },
        await makeCacheDir(),
      )

    expect(await tourStatus(dir, await codeOf())).toEqual({
      kind: "missing",
      name: "a-refund-request",
    })

    await saveTourOf(dir, await codeOf(), "a-refund-request")
    expect((await tourStatus(dir, await codeOf())).kind).toBe("ready")

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await tourStatus(dir, await codeOf())).toEqual({
      kind: "stale",
      name: "a-refund-request",
      staleSteps: 1,
      steps: 1,
    })
  })

  test("is stale once the branch moves on, counting the steps whose files changed", async () => {
    const dir = await makeBranchRepo()
    await saveTourOf(dir, await changeOf(dir), "feature-refunds")

    await commit(dir, "README.md", "more docs\n")
    expect(await tourStatus(dir, await changeOf(dir))).toEqual({
      kind: "stale",
      name: "feature-refunds",
      staleSteps: 0,
      steps: 1,
    })

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await tourStatus(dir, await changeOf(dir))).toMatchObject({
      kind: "stale",
      staleSteps: 1,
    })
  })

  test("is building while a stale tour is updated", async () => {
    const dir = await makeBranchRepo()
    await saveTourOf(dir, await changeOf(dir), "feature-refunds")
    await commit(dir, "app.ts", "const total = 300\n")

    await startBuild(dir, [], "feature-refunds", "sleep 1; true")
    expect((await tourStatus(dir, await changeOf(dir))).kind).toBe("building")
    await untilEnded(dir, "feature-refunds")
  })
})
