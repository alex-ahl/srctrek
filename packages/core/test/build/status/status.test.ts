import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  TREKS_DIR,
  buildState,
  loadTrek,
  resolveChange,
  startBuild,
  trekStatus,
} from "../../../src/index"
import { changeOf, commit, makeBranchRepo, makeCacheDir, saveTrekOf } from "@srctrek/testing"

// Rewrites one field of a saved trek, as an older srctrek would have written it.
async function editSavedTrek(dir: string, name: string, field: string, value: unknown) {
  const path = join(dir, TREKS_DIR, `${name}.json`)
  const trek = await loadTrek(path)
  await writeFile(path, JSON.stringify({ ...trek, [field]: value }))
}

async function untilEnded(root: string, name: string): Promise<void> {
  for (let tries = 0; tries < 100 && (await buildState(root, name)) === "building"; tries++) {
    await Bun.sleep(50)
  }
}

describe("trekStatus", () => {
  test("is missing before any build, under the name a new trek would get", async () => {
    const dir = await makeBranchRepo()

    expect(await trekStatus(dir, await changeOf(dir))).toEqual({
      kind: "missing",
      name: "feature-refunds",
    })
  })

  test("is empty when the branch hasn't moved from where it left the base", async () => {
    const dir = await makeBranchRepo()

    expect(await trekStatus(dir, await changeOf(dir, "HEAD..HEAD"))).toEqual({
      kind: "empty",
      name: "feature-refunds",
    })
  })

  test("is ready once a trek of the change is saved, whatever its name", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTrekOf(dir, change, "my-refunds")

    expect(await trekStatus(dir, change)).toEqual({ kind: "ready", name: "my-refunds" })
  })

  test("is ready again for the same uncommitted work", async () => {
    const dir = await makeBranchRepo()
    await writeFile(join(dir, "app.ts"), "const total = 300\n")
    await saveTrekOf(dir, await changeOf(dir, "", true), "work-in-progress")

    expect(await trekStatus(dir, await changeOf(dir, "", true))).toEqual({
      kind: "ready",
      name: "work-in-progress",
    })
  })

  test("is building while the agent works, and failed with the log's end when it fails", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await startBuild(dir, [], "feature-refunds", "sleep 0.3; echo 'cannot reach the server'; false")

    expect(await trekStatus(dir, change)).toEqual({
      kind: "building",
      name: "feature-refunds",
      logTail: [],
    })
    await untilEnded(dir, "feature-refunds")
    expect(await trekStatus(dir, change)).toEqual({
      kind: "failed",
      name: "feature-refunds",
      logTail: ["cannot reach the server"],
    })
  })

  test("is missing again when a build saved its trek and the trek was then removed", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await startBuild(
      dir,
      [],
      "feature-refunds",
      "echo 'trek: saved .srctrek/treks/feature-refunds.json'; true",
    )
    await untilEnded(dir, "feature-refunds")

    expect(await trekStatus(dir, change)).toEqual({ kind: "missing", name: "feature-refunds" })
  })

  test("a code trek is named after its trigger, found again, and stale once the code moves on", async () => {
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

    expect(await trekStatus(dir, await codeOf())).toEqual({
      kind: "missing",
      name: "a-refund-request",
    })

    await saveTrekOf(dir, await codeOf(), "a-refund-request")
    expect((await trekStatus(dir, await codeOf())).kind).toBe("ready")

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await trekStatus(dir, await codeOf())).toEqual({
      kind: "stale",
      name: "a-refund-request",
      staleStops: 1,
      stops: 1,
    })
  })

  test("is stale once the branch moves on, counting the steps whose files changed", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "feature-refunds")

    await commit(dir, "README.md", "more docs\n")
    expect(await trekStatus(dir, await changeOf(dir))).toEqual({
      kind: "stale",
      name: "feature-refunds",
      staleStops: 0,
      stops: 1,
    })

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await trekStatus(dir, await changeOf(dir))).toMatchObject({
      kind: "stale",
      staleStops: 1,
    })
  })

  test("is building while a stale trek is updated", async () => {
    const dir = await makeBranchRepo()
    await saveTrekOf(dir, await changeOf(dir), "feature-refunds")
    await commit(dir, "app.ts", "const total = 300\n")

    await startBuild(dir, [], "feature-refunds", "sleep 1; true")
    expect((await trekStatus(dir, await changeOf(dir))).kind).toBe("building")
    await untilEnded(dir, "feature-refunds")
  })

  test("is built with an older guide when the prompts that built it differ from today's", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTrekOf(dir, change, "my-refunds")
    await editSavedTrek(dir, "my-refunds", "prompt_hash", "an-older-guide")

    expect(await trekStatus(dir, change)).toEqual({ kind: "older-guide", name: "my-refunds" })
  })

  test("is building while a trek built with an older guide is rebuilt, and failed if that fails", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTrekOf(dir, change, "my-refunds")
    await editSavedTrek(dir, "my-refunds", "prompt_hash", "an-older-guide")

    await startBuild(dir, [], "my-refunds", "sleep 0.3; echo 'cannot reach the server'; false")
    expect((await trekStatus(dir, change)).kind).toBe("building")
    await untilEnded(dir, "my-refunds")
    expect(await trekStatus(dir, change)).toEqual({
      kind: "failed",
      name: "my-refunds",
      logTail: ["cannot reach the server"],
    })
  })

  test("is unreadable when the trek under the change's name isn't valid, not missing", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTrekOf(dir, change, "feature-refunds")
    await editSavedTrek(dir, "feature-refunds", "format_version", 2)

    expect(await trekStatus(dir, change)).toEqual({
      kind: "unreadable",
      name: "feature-refunds",
      problem: "format_version: Invalid input: expected 1",
    })
  })

  test("can't be opened when it names a local repo that isn't there", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTrekOf(dir, change, "my-refunds")
    const trek = await loadTrek(join(dir, TREKS_DIR, "my-refunds.json"))
    const worker = { name: "worker", source: "../no-worker-here", revision: "a".repeat(40) }
    await editSavedTrek(dir, "my-refunds", "repos", [...trek.repos, worker])

    expect(await trekStatus(dir, change)).toEqual({
      kind: "unreachable",
      name: "my-refunds",
      unreachable: {
        repo: "worker",
        source: "../no-worker-here",
        revision: "a".repeat(40),
        reason: "missing",
      },
    })
  })

  test("can't be opened when a repo it names lacks the trek's commit", async () => {
    const dir = await makeBranchRepo()
    const change = await changeOf(dir)
    await saveTrekOf(dir, change, "my-refunds")
    const trek = await loadTrek(join(dir, TREKS_DIR, "my-refunds.json"))
    const repos = trek.repos.map((repo) => ({ ...repo, revision: "b".repeat(40) }))
    await editSavedTrek(dir, "my-refunds", "repos", repos)

    expect(await trekStatus(dir, change)).toMatchObject({
      kind: "unreachable",
      unreachable: { reason: "no-commit", revision: "b".repeat(40) },
    })
  })
})
