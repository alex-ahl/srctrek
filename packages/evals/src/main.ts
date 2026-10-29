import {
  BUILD_LOG_PREFIX,
  type BuildMode,
  type Tour,
  buildLogTail,
  buildState,
  carryOver,
  directoryIn,
  loadTour,
  readChangeArguments,
  resolveChange,
  startBuild,
  tourPath,
} from "@codetrail/core"
import { type Expected, readExpected } from "./expected"
import { type Fixture, applyFollowups, buildFixture } from "./fixture"
import { type RunFacts, type UpdateFacts, formatReport } from "./report"
import { scoreTour } from "./score"

const TOUR_NAME = "eval"
const POLL_MS = 2000

function agentCommand(): string {
  const command = process.env["CODETRAIL_AGENT"]?.trim()
  if (command === undefined || command === "") {
    throw new Error("set CODETRAIL_AGENT to the agent's headless command line")
  }

  return command
}

async function untilBuilt(root: string): Promise<void> {
  while ((await buildState(root, TOUR_NAME)) === "building") {
    await Bun.sleep(POLL_MS)
  }
}

// The agent's own last word, where an agent prints its usage and cost; trail mcp's lines
// are left out.
async function agentSummary(root: string): Promise<string> {
  const tail = await buildLogTail(root, TOUR_NAME, 50)

  return tail.filter((line) => !line.startsWith(BUILD_LOG_PREFIX)).at(-1) ?? "(nothing)"
}

type Run = Expected["run"]

// The fixture repo trail runs in.
function runsIn(fixture: Fixture, run: Run): string {
  const root = fixture.repos[run.in]
  if (root === undefined) {
    throw new Error(`no repo ${run.in} in the fixture`)
  }

  return root
}

// Starts the agent on the tour and waits for it to end; how long it took, and its log.
async function buildTour(root: string, args: string[], agent: string, mode: BuildMode = "build") {
  const started = Date.now()
  const { log } = await startBuild(root, args, TOUR_NAME, agent, mode)
  await untilBuilt(root)
  if ((await buildState(root, TOUR_NAME)) !== "done") {
    throw new Error(
      `the agent saved no tour; its last line: ${await agentSummary(root)}\nlog: ${log}`,
    )
  }

  return { seconds: Math.round((Date.now() - started) / 1000), log }
}

/**
 * How to run an eval other than as expected.json says: `run` starts trail elsewhere, such as
 * in one repo with the others left for the agent to find; `asReviewer` builds the repos as a
 * reviewer has them, the work only on origin's branches; `update` then commits the fixture's
 * follow-ups and has the agent update the tour, to compare its cost with the first build.
 */
export type EvalOptions = { run?: Run | undefined; asReviewer?: boolean; update?: boolean }

// What the change looks like to trail started with `args` in `root`, as it is now.
async function changeAt(root: string, args: string[]) {
  return resolveChange(root, readChangeArguments(args, directoryIn(root)))
}

// Commits the follow-ups, then has the agent update the tour: how much of it should carry
// over, worked out the way update_tour does, and what the update took.
async function updateTour(
  fixture: Fixture,
  root: string,
  args: string[],
  agent: string,
  built: Tour,
): Promise<UpdateFacts> {
  const touched = await applyFollowups(fixture)
  if (touched.length === 0) {
    throw new Error("this fixture has no followup.patch to update the tour after")
  }

  const { draft, redo } = await carryOver(built, await changeAt(root, args))
  const { seconds } = await buildTour(root, args, agent, "update")

  return {
    seconds,
    kept: draft.steps.length,
    redo: redo.length,
    agentSummary: await agentSummary(root),
  }
}

/** Builds fixture `name`'s repos, has the agent tour them, and reports the tour's score. */
export async function runEval(
  name: string,
  agent: string,
  { run, asReviewer = false, update = false }: EvalOptions = {},
): Promise<string> {
  const fixture = await buildFixture(name, { asReviewer })
  const expected = await readExpected(fixture.dir)
  const { in: repo, args } = run ?? expected.run
  const root = runsIn(fixture, { in: repo, args })

  const { seconds, log } = await buildTour(root, args, agent)
  const built = await loadTour(tourPath(root, TOUR_NAME))
  const facts: RunFacts = {
    seconds,
    steps: built.steps.length,
    agentSummary: await agentSummary(root),
    log,
    tour: tourPath(root, TOUR_NAME),
  }
  if (!update) {
    return formatReport(name, scoreTour(built, expected, repo), facts)
  }

  const updated = await updateTour(fixture, root, args, agent, built)
  const tour = await loadTour(tourPath(root, TOUR_NAME))

  return formatReport(name, scoreTour(tour, expected, repo), { ...facts, update: updated })
}

// "<fixture>" runs as expected.json says; "<fixture> <repo> <args…>" runs trail in that repo;
// --reviewer, anywhere, builds the repos as a reviewer has them; --update updates the tour
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
      "usage: bun packages/evals/src/main.ts <fixture> [--reviewer] [--update] [<repo> <trail args>…]",
    )
    process.exit(2)
  }

  console.log(await runEval(name, agentCommand(), optionsFromArgs(rest)))
}
