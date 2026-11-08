import {
  BUILD_LOG_PREFIX,
  type BuildMode,
  type Trek,
  buildLogTail,
  buildState,
  carryOver,
  directoryIn,
  loadTrek,
  readChangeArguments,
  resolveChange,
  startBuild,
  trekPath,
} from "@srctrek/core"
import { type Expected, readExpected } from "./expected"
import { type Fixture, applyFollowups, buildFixture } from "./fixture"
import { type RunFacts, type UpdateFacts, formatReport } from "./report"
import { scoreTrek } from "./score"

const TREK_NAME = "eval"
const POLL_MS = 2000

function agentCommand(): string {
  const command = process.env["SRCTREK_AGENT"]?.trim()
  if (command === undefined || command === "") {
    throw new Error("set SRCTREK_AGENT to the agent's headless command line")
  }

  return command
}

async function untilBuilt(root: string): Promise<void> {
  while ((await buildState(root, TREK_NAME)) === "building") {
    await Bun.sleep(POLL_MS)
  }
}

// The agent's own last word, where an agent prints its usage and cost; trek mcp's lines
// are left out.
async function agentSummary(root: string): Promise<string> {
  const tail = await buildLogTail(root, TREK_NAME, 50)

  return tail.filter((line) => !line.startsWith(BUILD_LOG_PREFIX)).at(-1) ?? "(nothing)"
}

type Run = Expected["run"]

// The fixture repo trek runs in.
function runsIn(fixture: Fixture, run: Run): string {
  const root = fixture.repos[run.in]
  if (root === undefined) {
    throw new Error(`no repo ${run.in} in the fixture`)
  }

  return root
}

// Starts the agent on the trek and waits for it to end; how long it took, and its log.
async function buildTrek(root: string, args: string[], agent: string, mode: BuildMode = "build") {
  const started = Date.now()
  const { log } = await startBuild(root, args, TREK_NAME, agent, mode)
  await untilBuilt(root)
  if ((await buildState(root, TREK_NAME)) !== "done") {
    throw new Error(
      `the agent saved no trek; its last line: ${await agentSummary(root)}\nlog: ${log}`,
    )
  }

  return { seconds: Math.round((Date.now() - started) / 1000), log }
}

/**
 * How to run an eval other than as expected.json says: `run` starts trek elsewhere, such as
 * in one repo with the others left for the agent to find; `asReviewer` builds the repos as a
 * reviewer has them, the work only on origin's branches; `update` then commits the fixture's
 * follow-ups and has the agent update the trek, to compare its cost with the first build.
 */
export type EvalOptions = { run?: Run | undefined; asReviewer?: boolean; update?: boolean }

// What the change looks like to trek started with `args` in `root`, as it is now.
async function changeAt(root: string, args: string[]) {
  return resolveChange(root, readChangeArguments(args, directoryIn(root)))
}

// Commits the follow-ups, then has the agent update the trek: how much of it should carry
// over, worked out the way update_trek does, and what the update took.
async function updateTrek(
  fixture: Fixture,
  root: string,
  args: string[],
  agent: string,
  built: Trek,
): Promise<UpdateFacts> {
  const touched = await applyFollowups(fixture)
  if (touched.length === 0) {
    throw new Error("this fixture has no followup.patch to update the trek after")
  }

  const { draft, redo } = await carryOver(built, await changeAt(root, args))
  const { seconds } = await buildTrek(root, args, agent, "update")

  return {
    seconds,
    kept: draft.steps.length,
    redo: redo.length,
    agentSummary: await agentSummary(root),
  }
}

/** Builds fixture `name`'s repos, has the agent trek them, and reports the trek's score. */
export async function runEval(
  name: string,
  agent: string,
  { run, asReviewer = false, update = false }: EvalOptions = {},
): Promise<string> {
  const fixture = await buildFixture(name, { asReviewer })
  const expected = await readExpected(fixture.dir)
  const { in: repo, args } = run ?? expected.run
  const root = runsIn(fixture, { in: repo, args })

  const { seconds, log } = await buildTrek(root, args, agent)
  const built = await loadTrek(trekPath(root, TREK_NAME))
  const facts: RunFacts = {
    seconds,
    steps: built.steps.length,
    agentSummary: await agentSummary(root),
    log,
    trek: trekPath(root, TREK_NAME),
  }
  if (!update) {
    return formatReport(name, scoreTrek(built, expected, repo), facts)
  }

  const updated = await updateTrek(fixture, root, args, agent, built)
  const trek = await loadTrek(trekPath(root, TREK_NAME))

  return formatReport(name, scoreTrek(trek, expected, repo), { ...facts, update: updated })
}

// "<fixture>" runs as expected.json says; "<fixture> <repo> <args…>" runs trek in that repo;
// --reviewer, anywhere, builds the repos as a reviewer has them; --update updates the trek
// after the fixture's follow-up commits.
function optionsFromArgs(words: string[]): EvalOptions {
  const flags = ["--reviewer", "--update"]
  const [repo, ...args] = words.filter((word) => !flags.includes(word))
  const run = repo === undefined ? undefined : { in: repo, args }

  return { run, asReviewer: words.includes("--reviewer"), update: words.includes("--update") }
}

if (import.meta.main) {
  const [name, ...rest] = process.argv.slice(2)
  if (name === undefined) {
    console.error(
      "usage: bun packages/evals/src/main.ts <fixture> [--reviewer] [--update] [<repo> <trek args>…]",
    )
    process.exit(2)
  }

  console.log(await runEval(name, agentCommand(), optionsFromArgs(rest)))
}
