import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type Trigger,
  buildState,
  loadTriggers,
  resolveChange,
  saveTriggers,
  startBuild,
  trekStatus,
  triggerProblems,
} from "../../src"
import { commit, makeBranchRepo, makeCacheDir } from "@srctrek/testing"

async function codeOf(dir: string) {
  const args = {
    changes: [],
    unchanged: [{ source: "." }],
    uncommitted: false,
    code: { trigger: undefined },
  }
  return resolveChange(dir, args, await makeCacheDir())
}

function triggerAt(repo: string, line: number): Trigger {
  return { kind: "command", name: "set the total", evidence: { repo, file: "app.ts", line } }
}

describe("triggers", () => {
  test("are checked like any citation: each evidence line exists and isn't blank", async () => {
    const dir = await makeBranchRepo()
    await commit(dir, "app.ts", "const total = 250\n\nexport { total }\n")
    const change = await codeOf(dir)
    const repo = change.repos[0]?.name ?? ""

    expect(await triggerProblems(change, [triggerAt(repo, 1)])).toEqual([])
    expect(await triggerProblems(change, [triggerAt(repo, 2)])).toEqual([
      `set the total: cites ${repo}/app.ts:2, which is blank`,
    ])
  })

  test("are found again only while the code they were found in hasn't moved", async () => {
    const dir = await makeBranchRepo()
    const change = await codeOf(dir)
    const triggers = [triggerAt(change.repos[0]?.name ?? "", 1)]
    await saveTriggers(dir, "found", change, triggers)

    expect(await loadTriggers(dir, "found", change)).toEqual(triggers)

    await commit(dir, "app.ts", "const total = 300\n")
    expect(await loadTriggers(dir, "found", await codeOf(dir))).toBeUndefined()
  })

  test("are what plain --code shows, once found", async () => {
    const dir = await makeBranchRepo()
    const change = await codeOf(dir)
    const name = `${change.repos[0]?.name ?? ""}-code`.toLowerCase()

    expect(await trekStatus(dir, change)).toEqual({ kind: "missing", name })

    const trigger = triggerAt(change.repos[0]?.name ?? "", 1)
    await saveTriggers(dir, name, change, [trigger])
    expect(await trekStatus(dir, change)).toEqual({
      kind: "triggers",
      name,
      triggers: [{ trigger, trek: { kind: "missing", name: "set-the-total" } }],
    })
  })

  test("give way to finding them again while that runs, and stay if it fails", async () => {
    const dir = await makeBranchRepo()
    const change = await codeOf(dir)
    const name = `${change.repos[0]?.name ?? ""}-code`.toLowerCase()
    await saveTriggers(dir, name, change, [triggerAt(change.repos[0]?.name ?? "", 1)])

    await startBuild(dir, [], name, "sleep 0.3; false")
    expect((await trekStatus(dir, change)).kind).toBe("building")
    for (let tries = 0; tries < 100 && (await buildState(dir, name)) === "building"; tries++) {
      await Bun.sleep(50)
    }
    expect((await trekStatus(dir, change)).kind).toBe("triggers")
  })

  test("are ignored when the saved file isn't a list of triggers", async () => {
    const dir = await makeBranchRepo()
    const change = await codeOf(dir)
    await saveTriggers(dir, "found", change, [])
    await writeFile(join(dir, ".srctrek/triggers/found.json"), "{ not json")

    expect(await loadTriggers(dir, "found", change)).toBeUndefined()
  })
})
