import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { type BuildState, buildState, headlessBuildPrompt, startBuild } from "../../../src/index"
import { makeRepo } from "@srctrek/testing"

// The build's state once it has ended; fails the test if it runs past `ms`.
async function stateWhenEnded(
  root: string,
  name: string,
  ms = 5000,
): Promise<BuildState | undefined> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const state = await buildState(root, name)
    if (state !== "building") {
      return state
    }

    await Bun.sleep(50)
  }

  throw new Error(`build ${name} still running after ${ms}ms`)
}

describe("background builds", () => {
  test("give the agent the instruction as its last argument, and log what it says", async () => {
    const root = await makeRepo()
    const files = await startBuild(root, ["main...feature"], "refunds", "printf '%s\\n'")

    expect(await stateWhenEnded(root, "refunds")).toBe("failed")
    expect(await readFile(files.log, "utf8")).toBe(
      `${headlessBuildPrompt(["main...feature"], "refunds")}\n`,
    )
  })

  test("tell the agent to update the saved trek when asked to", async () => {
    const root = await makeRepo()
    const files = await startBuild(root, [], "refunds", "printf %s", "update")
    await stateWhenEnded(root, "refunds")

    const prompt = await readFile(files.log, "utf8")
    expect(prompt).toBe(headlessBuildPrompt([], "refunds", "update"))
    expect(prompt).toContain("call update_trek with `refunds` instead of start_trek")
    expect(prompt).not.toContain("Save the finished trek")
  })

  test("are done when the agent exits cleanly having saved the trek", async () => {
    const root = await makeRepo()
    const agent = "mkdir -p .srctrek/treks && echo '{}' > .srctrek/treks/refunds.json && true"
    await startBuild(root, [], "refunds", agent)

    expect(await stateWhenEnded(root, "refunds")).toBe("done")
  })

  test("are building while the agent runs, and failed when it exits with an error", async () => {
    const root = await makeRepo()
    await startBuild(root, [], "refunds", "sleep 0.3 && false")

    expect(await buildState(root, "refunds")).toBe("building")
    expect(await stateWhenEnded(root, "refunds")).toBe("failed")
  })

  test("have no state when none was started", async () => {
    expect(await buildState(await makeRepo(), "refunds")).toBeUndefined()
  })
})
