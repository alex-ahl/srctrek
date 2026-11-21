import {
  type BuildMode,
  type Trek,
  BUILD_LOG_PREFIX,
  buildLogTail,
  buildState,
  carryOver,
  changeFromArguments,
  loadTrek,
  startBuild,
  trekPath,
} from "@srctrek/core"
import {
  BASELINE_PATH,
  type RunRecord,
  compareLine,
  readBaseline,
  recordOf,
  withRuns,
  writeBaseline,
} from "./baseline"
import { type Expected, readExpected } from "./expected"
import { type Fixture, applyFollowups, buildFixture, fixtureNames } from "./fixture"
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

  const { draft, redo } = await carryOver(built, await changeFromArguments(root, args))
  const { seconds } = await buildTrek(root, args, agent, "update")

  return {
    seconds,
    kept: draft.steps.length,
    redo: redo.length,
    agentSummary: await agentSummary(root),
  }
}

/** An eval's report, and the run as the baseline keeps it. */
export type EvalResult = Readonly<{ report: string; record: RunRecord }>

/** Builds fixture `name`'s repos, has the agent trek them, and reports the trek's score. */
export async function runEval(name: string, agent: string, options: EvalOptions = {}) {
  return (await evalRun(name, agent, options)).report
}

/** As runEval, with the run as the baseline keeps it too. */
export async function evalRun(
  name: string,
  agent: string,
  { run, asReviewer = false, update = false }: EvalOptions = {},
): Promise<EvalResult> {
  const fixture = await buildFixture(name, { asReviewer })
  const expected = await readExpected(fixture.dir)
  const runs = run ?? expected.run
  const root = runsIn(fixture, runs)
  const trek = trekPath(root, TREK_NAME)

  const { seconds, log } = await buildTrek(root, runs.args, agent)
  const built = await loadTrek(trek)
  const facts: RunFacts = {
    seconds,
    steps: built.steps.length,
    agentSummary: await agentSummary(root),
    log,
    trek,
  }
  const score = scoreTrek(built, expected, runs.in)
  const record = recordOf(score, seconds, facts.agentSummary)
  if (!update) {
    return { report: formatReport(name, score, facts), record }
  }

  const updated = await updateTrek(fixture, root, runs.args, agent, built)
  const rebuilt = await loadTrek(trek)
  const report = formatReport(name, scoreTrek(rebuilt, expected, runs.in), {
    ...facts,
    update: updated,
  })
  return { report, record }
}

// The commit the evals run at, "+changes" when the work tree differs from it.
function headCommit(): string {
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", ...args], { cwd: import.meta.dir })
      .stdout.toString()
      .trim()
  return `${git("rev-parse", "--short", "HEAD")}${git("status", "--porcelain") === "" ? "" : "+changes"}`
}

// Runs each fixture named, or every fixture, BASELINE_RUNS times, and writes their runs as
// the baseline, keeping the other fixtures' runs as they were. Before each run it says which,
// on stderr, as a run takes minutes and prints nothing until it ends.
const BASELINE_RUNS = 2

async function takeBaseline(names: string[], agent: string): Promise<void> {
  let baseline = await readBaseline(BASELINE_PATH)
  for (const name of names.length > 0 ? names : await fixtureNames()) {
    const results = []
    for (let run = 0; run < BASELINE_RUNS; run++) {
      console.error(`baseline: ${name}, run ${String(run + 1)} of ${String(BASELINE_RUNS)}…`)
      const result = await evalRun(name, agent)
      console.log(`${result.report}\n`)
      results.push(result.record)
    }

    baseline = withRuns(baseline, name, headCommit(), results)
    await writeBaseline(BASELINE_PATH, baseline)
  }

  console.log(`baseline written to ${BASELINE_PATH}`)
}

// The report, then how the run compares with its fixture's baseline, when there is one.
async function reportWithBaseline(name: string, result: EvalResult): Promise<string> {
  const baseline = await readBaseline(BASELINE_PATH)
  const entry = baseline?.fixtures[name]
  const against =
    baseline === undefined || entry === undefined
      ? "none for this fixture yet"
      : compareLine(result.record, entry, baseline.watch)
  return `${result.report}\nBaseline ${against}`
}

// "<fixture>" runs as expected.json says; "<fixture> <repo> <args…>" runs trek in that repo;
// --reviewer, anywhere, builds the repos as a reviewer has them; --update updates the trek
// after the fixture's follow-up commits. "--baseline [<fixture>…]" takes the baseline.
const REVIEWER = "--reviewer"
const UPDATE = "--update"

function optionsFromArgs(words: string[]): EvalOptions {
  const [repo, ...args] = words.filter((word) => word !== REVIEWER && word !== UPDATE)
  const run = repo === undefined ? undefined : { in: repo, args }

  return { run, asReviewer: words.includes(REVIEWER), update: words.includes(UPDATE) }
}

const BASELINE = "--baseline"

if (import.meta.main) {
  const [name, ...rest] = process.argv.slice(2)
  if (name === undefined) {
    console.error(
      "usage: bun packages/evals/src/main.ts <fixture> [--reviewer] [--update] [<repo> <trek args>…]\n" +
        "       bun packages/evals/src/main.ts --baseline [<fixture>…]",
    )
    process.exit(2)
  }

  if (name === BASELINE) {
    await takeBaseline(rest, agentCommand())
  } else {
    const result = await evalRun(name, agentCommand(), optionsFromArgs(rest))
    console.log(await reportWithBaseline(name, result))
  }
}
