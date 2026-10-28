import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, realpath, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { BUILD_LOG_ENV, BUILD_STOPPED, loadTour, runGit } from "@codetrail/core"
import { commit, commitStaged, makeRepo } from "../../core/test/support/repo"
import { McpTestClient } from "./mcp-client"

// A repo on a feature branch that changes line 1 of src/app.ts.
async function makeFeatureRepo(): Promise<string> {
  const dir = await makeRepo()
  await mkdir(join(dir, "src"))
  await writeFile(join(dir, "src/app.ts"), "const total = 100\nexport { total }\n")
  await runGit(dir, ["add", "--all"])
  await commitStaged(dir, "base")
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  await commit(dir, "src/app.ts", "const total = 250\nexport { total }\n")

  return dir
}

const header = {
  title: "Total",
  overview: "The total changes from 100 to 250.",
  trigger: { kind: "command", input: "import the total" },
  outcome: "total is 250",
}

function stepsFor(repo: string) {
  const s1 = {
    id: "s1",
    repo,
    file: "src/app.ts",
    start_line: 1,
    end_line: 1,
    kind: "context",
    summary: "The total is set.",
    details: "The change raises it.",
    via: null,
    predicted_values: [{ name: "total", value: "250", line: 1, role: "assignment" }],
  }
  const { predicted_values: _, ...withoutValues } = s1
  const s2 = { ...withoutValues, id: "s2", start_line: 2, end_line: 2, kind: "return", from: "s1" }
  const s2WithEvidence = {
    ...s2,
    via: { cites: [{ repo, file: "src/app.ts", line: 2 }], guessed: false },
  }

  return { s1, s2, s2WithEvidence }
}

let client: McpTestClient | undefined

afterEach(() => client?.close())

describe("building a tour over trail mcp", () => {
  test("checks steps on the way in, the tour as a whole at the end, then saves it", async () => {
    const dir = await makeFeatureRepo()
    const repo = basename(dir)
    const { s1, s2, s2WithEvidence } = stepsFor(repo)
    client = new McpTestClient(dir)
    await client.initialize()
    await client.call("open_change", { args: [] })
    await client.call("start_tour", header)

    const outOfRange = await client.call("add_steps", { steps: [s1, { ...s2, end_line: 9 }] })
    expect(outOfRange).toEqual({
      text: `nothing was added:\ns2: ends at ${repo}/src/app.ts:9, past its last line (2)`,
      isError: true,
    })

    expect((await client.call("add_steps", { steps: [s1, s2] })).text).toBe(
      "added s1, s2; the tour has s1, s2",
    )
    const unfinished = await client.call("finish_tour", { name: "total" })
    expect(unfinished.isError).toBe(true)
    expect(unfinished.text).toContain("steps.1 (s2).via: missing evidence")

    expect((await client.call("add_steps", { steps: [s2WithEvidence] })).text).toBe(
      "added s2; the tour has s1, s2",
    )
    const saved = await client.call("finish_tour", { name: "total" })
    // trail runs in the folder's real path; tmp is a symlink on macOS
    expect(saved.text).toBe(`saved ${join(await realpath(dir), ".codetrail/tours/total.json")}`)

    const tour = await loadTour(join(dir, ".codetrail/tours/total.json"))
    expect(tour.steps.map((step) => [step.id, step.changed])).toEqual([
      ["s1", true],
      ["s2", false],
    ])
    expect(tour.repos[0]?.range).toMatch(/^[0-9a-f]{40}\.\.[0-9a-f]{40}$/)
    expect(await Bun.file(join(dir, ".codetrail/tours/total.changed.json")).json()).toEqual({
      [repo]: { "src/app.ts": { "1": "changed" } },
    })
  })

  test("stops the build at the third rejected round", async () => {
    const dir = await makeFeatureRepo()
    const { s1 } = stepsFor(basename(dir))
    client = new McpTestClient(dir)
    await client.initialize()
    await client.call("open_change", { args: [] })
    await client.call("start_tour", header)

    const outOfRange = { ...s1, end_line: 9, predicted_values: [] }
    await client.call("add_steps", { steps: [outOfRange] })
    await client.call("add_steps", { steps: [outOfRange] })
    const third = await client.call("add_steps", { steps: [outOfRange] })

    expect(third.isError).toBe(true)
    expect(third.text).toEndWith(BUILD_STOPPED)
    expect((await client.call("add_steps", { steps: [s1] })).text).toBe(
      "no tour is started: call start_tour first",
    )
  })

  test("writes what it tells the agent into the build's log, when trail started the agent", async () => {
    const dir = await makeFeatureRepo()
    const { s1 } = stepsFor(basename(dir))
    const log = join(dir, "build.log")
    await writeFile(log, "")
    client = new McpTestClient(dir, { [BUILD_LOG_ENV]: log })
    await client.initialize()

    await client.call("open_change", { args: [] })
    await client.call("start_tour", header)
    await client.call("add_steps", { steps: [s1] })

    expect((await Bun.file(log).text()).split("\n")).toEqual([
      `trail: opened ${basename(dir)}`,
      'trail: started "Total": add steps with add_steps',
      "trail: added s1; the tour has s1",
      "",
    ])
  })
})
