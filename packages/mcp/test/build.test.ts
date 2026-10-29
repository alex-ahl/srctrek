import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, realpath, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import {
  BUILD_LOG_ENV,
  BUILD_STOPPED,
  loadProposals,
  loadTour,
  proposalOpenedAnswer,
  proposalUnopenedAnswer,
  runGit,
} from "@codetrail/core"
import { commit, commitStaged, makeRepo } from "../../core/test/support/repo"
import { McpTestClient } from "./mcp-client"
import { tempDir } from "../../core/test/support/temp"

// A repo on a feature branch that changes line 1 of src/app.ts.
async function makeFeatureRepo(): Promise<string> {
  return addFeature(await makeRepo())
}

// The same, at `dir`, for a test that needs repos side by side.
async function featureRepoIn(dir: string): Promise<string> {
  await mkdir(dir)
  await runGit(dir, ["init", "--quiet", "--initial-branch=main"])
  await commit(dir, "README.md", "base\n")
  return addFeature(dir)
}

// Commits src/app.ts, then a feature branch that changes its line 1.
async function addFeature(dir: string): Promise<string> {
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

  test("records the triggers found in code opened with plain --code, checking their evidence", async () => {
    const dir = await makeFeatureRepo()
    const repo = basename(dir)
    client = new McpTestClient(dir)
    await client.initialize()
    await client.call("open_change", { args: ["--code"] })

    const trigger = (line: number) => ({
      kind: "command",
      name: "set the total",
      evidence: { repo, file: "src/app.ts", line },
    })

    const wrong = await client.call("record_triggers", { triggers: [trigger(9)] })
    expect(wrong).toEqual({
      text: `nothing was recorded:\nset the total: cites ${repo}/src/app.ts:9, past its last line (2)`,
      isError: true,
    })

    const recorded = await client.call("record_triggers", { triggers: [trigger(1)] })
    expect(recorded.text).toMatch(/^saved 1 triggers to .*\/\.codetrail\/triggers\/.*-code\.json$/)
  })

  test("records a repo the route leads into, checking its evidence, and says when it can't open it", async () => {
    const dir = await makeFeatureRepo()
    const repo = basename(dir)
    client = new McpTestClient(dir)
    await client.initialize()
    await client.call("open_change", { args: ["main...feature"] })

    const proposal = (line: number) => ({
      name: "payments",
      reason: "the total is sent to the payments service",
      evidence: [{ repo, file: "src/app.ts", line }],
    })

    const wrong = await client.call("propose_repo", proposal(9))
    expect(wrong).toEqual({
      text: `nothing was proposed:\ncites ${repo}/src/app.ts:9, past its last line (2)`,
      isError: true,
    })

    const proposed = await client.call("propose_repo", proposal(1))
    expect(proposed.text).toBe(proposalUnopenedAnswer("payments", "no source was given"))
    expect(await loadProposals(dir)).toEqual([proposal(1)])

    const missing = await client.call("propose_repo", { ...proposal(1), source: "../nowhere" })
    expect(missing.text).toContain("it isn't opened (no repo at ../nowhere")
  })

  test("opens a proposed repo it can find, so the tour goes on into it and records it", async () => {
    const parent = await tempDir("route-")
    const web = await featureRepoIn(join(parent, "web"))
    const payments = join(parent, "payments")
    await mkdir(payments)
    await runGit(payments, ["init", "--quiet", "--initial-branch=main"])
    await commit(payments, "charge.ts", "export const charged = 250\n")
    client = new McpTestClient(web)
    await client.initialize()
    await client.call("open_change", { args: ["main...feature"] })
    await client.call("start_tour", header)

    const proposed = await client.call("propose_repo", {
      name: "payments",
      source: "../payments",
      reason: "the total is charged by the payments service",
      evidence: [{ repo: "web", file: "src/app.ts", line: 1 }],
    })
    const head = await runGit(payments, ["rev-parse", "HEAD"])
    const readAt = { kind: "default" as const, why: "../payments has no branch feature" }
    expect(proposed.text).toBe(proposalOpenedAnswer("payments", head.slice(0, 7), readAt))

    const read = await client.call("read_file", { repo: "payments", path: "charge.ts" })
    expect(read.text).toBe("charge.ts\n1 | export const charged = 250")

    const { s1 } = stepsFor("web")
    const charge = {
      ...s1,
      id: "s2",
      repo: "payments",
      file: "charge.ts",
      kind: "hop",
      from: "s1",
      via: { cites: [{ repo: "web", file: "src/app.ts", line: 1 }], guessed: true },
      predicted_values: [{ name: "charged", value: "250", line: 1, role: "assignment" }],
    }
    const added = await client.call("add_steps", { steps: [s1, charge] })
    expect(added.text).toBe("added s1, s2; the tour has s1, s2")

    const saved = await client.call("finish_tour", { name: "charge" })
    const tour = await loadTour(saved.text.replace("saved ", ""))
    expect(tour.repos.map(({ name }) => name)).toEqual(["web", "payments"])
  })

  test("from a folder inside the repo, a nearby repo is named by the path that opens it", async () => {
    const parent = await tempDir("inside-")
    const web = await featureRepoIn(join(parent, "web"))
    const payments = join(parent, "payments")
    await mkdir(payments)
    await runGit(payments, ["init", "--quiet", "--initial-branch=main"])
    await commit(payments, "charge.ts", "export const charged = 250\n")
    client = new McpTestClient(join(web, "src"))
    await client.initialize()

    const opened = await client.call("open_change", { args: ["main...feature"] })
    const nearby = opened.text.split("\n").at(-1)
    expect(nearby).toBe("not opened, next to this repo: ../payments")

    const proposed = await client.call("propose_repo", {
      name: "payments",
      source: "../payments",
      reason: "the total is charged by the payments service",
      evidence: [{ repo: "web", file: "src/app.ts", line: 1 }],
    })
    expect(proposed.text).toStartWith("Proposed payments and opened it")
  })

  test("opens a proposed repo on the work's branch as part of the change", async () => {
    const parent = await tempDir("work-")
    const web = await featureRepoIn(join(parent, "web"))
    const payments = await featureRepoIn(join(parent, "payments"))
    client = new McpTestClient(web)
    await client.initialize()
    await client.call("open_change", { args: ["main...feature"] })

    const proposed = await client.call("propose_repo", {
      name: "payments",
      source: "../payments",
      reason: "the total is charged by the payments service",
      evidence: [{ repo: "web", file: "src/app.ts", line: 1 }],
    })
    const head = await runGit(payments, ["rev-parse", "feature"])
    const readAt = { kind: "work-branch" as const, branch: "feature", shown: "feature" }

    expect(proposed.text).toBe(proposalOpenedAnswer("payments", head.slice(0, 7), readAt))
    expect((await client.call("diff", { repo: "payments" })).text).toBe("modified src/app.ts")
  })
})
