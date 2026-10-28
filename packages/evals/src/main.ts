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

// The repo expected.json says trail runs in.
function runsIn(fixture: Fixture, expected: Expected): string {
  const root = fixture.repos[expected.run.in]
  if (root === undefined) {
    throw new Error(`expected.json runs in ${expected.run.in}, which isn't one of the repos`)
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

/** Builds fixture `name`'s repos, has the agent tour them, and reports the tour's score. */
export async function runEval(name: string, agent: string): Promise<string> {
  const fixture = await buildFixture(name)
  const expected = await readExpected(fixture.dir)
  const root = runsIn(fixture, expected)

  const { seconds, log } = await buildTour(root, expected.run.args, agent)
  const tour = await loadTour(tourPath(root, TOUR_NAME))
  const facts = {
    seconds,
    steps: tour.steps.length,
    agentSummary: await agentSummary(root),
    log,
    tour: tourPath(root, TOUR_NAME),
  }

  return formatReport(name, scoreTour(tour, expected), facts)
}

if (import.meta.main) {
  const name = process.argv[2]
  if (name === undefined) {
    console.error("usage: bun packages/evals/src/main.ts <fixture>")
    process.exit(2)
  }

  console.log(await runEval(name, agentCommand()))
}
