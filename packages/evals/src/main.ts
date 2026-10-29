import {
  BUILD_LOG_PREFIX,
  buildLogTail,
  buildState,
  loadTour,
  startBuild,
  tourPath,
} from "@codetrail/core"
import { type Expected, readExpected } from "./expected"
import { type Fixture, buildFixture } from "./fixture"
import { formatReport } from "./report"
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
async function buildTour(root: string, args: string[], agent: string) {
  const started = Date.now()
  const { log } = await startBuild(root, args, TOUR_NAME, agent)
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
 * reviewer has them, the work only on origin's branches.
 */
export type EvalOptions = { run?: Run | undefined; asReviewer?: boolean }

/** Builds fixture `name`'s repos, has the agent tour them, and reports the tour's score. */
export async function runEval(
  name: string,
  agent: string,
  { run, asReviewer = false }: EvalOptions = {},
): Promise<string> {
  const fixture = await buildFixture(name, { asReviewer })
  const expected = await readExpected(fixture.dir)
  const { in: repo, args } = run ?? expected.run
  const root = runsIn(fixture, { in: repo, args })

  const { seconds, log } = await buildTour(root, args, agent)
  const tour = await loadTour(tourPath(root, TOUR_NAME))
  const facts = {
    seconds,
    steps: tour.steps.length,
    agentSummary: await agentSummary(root),
    log,
    tour: tourPath(root, TOUR_NAME),
  }

  return formatReport(name, scoreTour(tour, expected, repo), facts)
}

// "<fixture>" runs as expected.json says; "<fixture> <repo> <args…>" runs trail in that repo;
// --reviewer, anywhere, builds the repos as a reviewer has them.
function optionsFromArgs(words: string[]): EvalOptions {
  const [repo, ...args] = words.filter((word) => word !== "--reviewer")
  const run = repo === undefined ? undefined : { in: repo, args }

  return { run, asReviewer: words.includes("--reviewer") }
}

if (import.meta.main) {
  const [name, ...rest] = process.argv.slice(2)
  if (name === undefined) {
    console.error(
      "usage: bun packages/evals/src/main.ts <fixture> [--reviewer] [<repo> <trail args>…]",
    )
    process.exit(2)
  }

  console.log(await runEval(name, agentCommand(), optionsFromArgs(rest)))
}
