import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { TREKS_DIR, buildState, loadTrek, pullRequestStatus, startBuild } from "../../../src/index"
import { changeOf, makeBranchRepo, saveTrekOf } from "@srctrek/testing"

// A trek saved as pr-12's, its changed repo's head that pull request: the commit it was built at.
async function savePullTrek(dir: string): Promise<string> {
  await saveTrekOf(dir, await changeOf(dir), "pr-12")
  const path = join(dir, TREKS_DIR, "pr-12.json")
  const trek = await loadTrek(path)
  const repos = trek.repos.map((repo) =>
    repo.range === undefined ? repo : { ...repo, head: { kind: "pull", number: 12 } },
  )
  await writeFile(path, JSON.stringify({ ...trek, repos }))

  return trek.repos.find((repo) => repo.range !== undefined)?.revision ?? ""
}

async function untilEnded(root: string, name: string): Promise<void> {
  for (let tries = 0; tries < 100 && (await buildState(root, name)) === "building"; tries++) {
    await Bun.sleep(50)
  }
}

describe("pullRequestStatus", () => {
  test("is missing with no trek saved under the pull request's name", async () => {
    const dir = await makeBranchRepo()

    expect(await pullRequestStatus(dir, { number: 12, head: "a12" })).toEqual({
      kind: "missing",
      name: "pr-12",
    })
  })

  test("is ready when its trek was built at the pull request's head", async () => {
    const dir = await makeBranchRepo()
    const built = await savePullTrek(dir)

    expect(await pullRequestStatus(dir, { number: 12, head: built })).toEqual({
      kind: "ready",
      name: "pr-12",
    })
  })

  test("is stale once the pull request's head has moved, how many stops changed not known", async () => {
    const dir = await makeBranchRepo()
    await savePullTrek(dir)

    expect(await pullRequestStatus(dir, { number: 12, head: "c12" })).toMatchObject({
      kind: "stale",
      name: "pr-12",
      staleStops: undefined,
    })
  })

  test("is ready still when its trek, built at the head, fails to build again, as its screen says", async () => {
    const dir = await makeBranchRepo()
    const built = await savePullTrek(dir)
    await startBuild(dir, [], "pr-12", "echo 'cannot reach the server'; false")
    await untilEnded(dir, "pr-12")

    expect(await pullRequestStatus(dir, { number: 12, head: built })).toEqual({
      kind: "ready",
      name: "pr-12",
    })
  })
})
