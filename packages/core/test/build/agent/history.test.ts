import { describe, expect, test } from "bun:test"
import { mkdir, rm, utimes, writeFile } from "node:fs/promises"
import { buildFiles, buildHistory, buildState, readBuild, startBuild } from "../../../src/index"
import { keepBuild } from "../../../src/build/agent/history"
import { makeRepo } from "@srctrek/testing"

async function untilEnded(root: string, name: string): Promise<void> {
  for (let tries = 0; tries < 100 && (await buildState(root, name)) === "building"; tries++) {
    await Bun.sleep(50)
  }
}

// A build's files as one that started at `minute` past nine would leave them, ended with `exit`.
async function pastBuild(root: string, name: string, minute: number, exit: string) {
  const files = await buildFiles(root, name)
  await mkdir(files.dir, { recursive: true })
  await writeFile(files.log, `trek: opened web\nbuild ${minute}\n`)
  await writeFile(files.pid, "1")
  await writeFile(files.exit, exit)
  const started = new Date(2026, 10, 17, 9, minute)
  await utimes(files.pid, started, started)
  return files
}

describe("a trek's builds", () => {
  test("keep the last one when a new one starts, newest first", async () => {
    const root = await makeRepo()
    await startBuild(root, [], "refunds", "printf 'first\\n'; true")
    await untilEnded(root, "refunds")
    await startBuild(root, [], "refunds", "printf 'second\\n'; true")
    await untilEnded(root, "refunds")

    const builds = await buildHistory(root, "refunds")
    const [latest, kept] = await Promise.all(builds.map((b) => readBuild(root, "refunds", b)))

    expect(builds.map((b) => b.latest)).toEqual([true, false])
    expect(latest?.log).toContain("second")
    expect(kept?.log).toContain("first")
    // its agent ended well but trek mcp never said the trek was saved
    expect(kept?.state).toBe("failed")
  })

  test("keep ten from before, dropping the oldest", async () => {
    const root = await makeRepo()
    for (let minute = 0; minute < 12; minute++) {
      const files = await pastBuild(root, "refunds", minute, "0\n")
      await keepBuild(files, "refunds")
    }

    const builds = await buildHistory(root, "refunds")
    const logs = await Promise.all(
      builds.map(async (b) => (await readBuild(root, "refunds", b)).log),
    )

    expect(builds).toHaveLength(10)
    expect(logs[0]).toContain("build 11")
    expect(logs.at(-1)).toContain("build 2")
  })

  test("keep one that never said how it ended as ended, when another replaces it", async () => {
    const root = await makeRepo()
    const files = await pastBuild(root, "refunds", 0, "0\n")
    await rm(files.exit)
    await keepBuild(files, "refunds")

    const [kept] = await buildHistory(root, "refunds")
    expect(kept === undefined ? undefined : (await readBuild(root, "refunds", kept)).state).toBe(
      "failed",
    )
  })
})
