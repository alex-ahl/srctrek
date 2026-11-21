import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { agentFields } from "./agent-numbers"
import type { Score } from "./score"

/** Where the baseline lives: tracked, next to the fixtures, written only on purpose. */
export const BASELINE_PATH = join(import.meta.dir, "../../../evals/baseline.json")

const SummarySchema = z.object({
  route: z.string(),
  inOrder: z.boolean(),
  links: z.string(),
  bugs: z.string(),
  stacks: z.string(),
})

const RunSchema = z.object({
  score: SummarySchema,
  seconds: z.number(),
  // every number the agent reported, by name, as agentFields reads them
  numbers: z.record(z.string(), z.number()),
})

const BaselineSchema = z.object({
  // the agent's numbers to compare, by name, set for the agent the evals run: "num_turns"
  watch: z.array(z.string()),
  fixtures: z.record(z.string(), z.object({ commit: z.string(), runs: z.array(RunSchema).min(1) })),
})

/** How a run scored, in the words the baseline keeps: "10/10", in order, "2/2"… */
export type ScoreSummary = z.infer<typeof SummarySchema>

/** One run as the baseline keeps it: its score, how long it took, and the agent's numbers. */
export type RunRecord = z.infer<typeof RunSchema>

/** The agent's numbers to compare, and each fixture's runs with the commit they were taken at. */
export type Baseline = z.infer<typeof BaselineSchema>

const ratio = (found: number, total: number) => `${String(found)}/${String(total)}`

/** A score in the words the baseline keeps. */
export function summaryOf(score: Score): ScoreSummary {
  const linked = score.links.filter(
    ({ found }) => found !== "no evidence" && found !== "not reached",
  )
  const bugs = score.bugs.filter(({ lines }) => lines.includes("high"))
  const stacks = score.stacks.filter(({ found }) => found.kind === "as expected")

  return {
    route: ratio(score.route.found, score.route.total),
    inOrder: score.route.inOrder,
    links: ratio(linked.length, score.links.length),
    bugs: ratio(bugs.length, score.bugs.length),
    stacks: ratio(stacks.length, score.stacks.length),
  }
}

/** A run as the baseline keeps it, from its score, its time, and the agent's last line. */
export function recordOf(score: Score, seconds: number, agentLine: string): RunRecord {
  return { score: summaryOf(score), seconds, numbers: agentFields(agentLine) }
}

/** The baseline at `path`; none when there isn't one yet. */
export async function readBaseline(path: string): Promise<Baseline | undefined> {
  const text = await readFile(path, "utf8").catch(() => undefined)
  return text === undefined ? undefined : BaselineSchema.parse(JSON.parse(text))
}

export async function writeBaseline(path: string, baseline: Baseline): Promise<void> {
  await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`)
}

/** `baseline` with fixture `name`'s runs replaced by `runs`, taken at `commit`. */
export function withRuns(
  baseline: Baseline | undefined,
  name: string,
  commit: string,
  runs: RunRecord[],
): Baseline {
  return {
    watch: baseline?.watch ?? [],
    fixtures: { ...baseline?.fixtures, [name]: { commit, runs } },
  }
}

const PARTS = ["route", "links", "bugs", "stacks"] as const

// How much of a part a run got: the found count of "9/10".
const found = (part: string) => Number(part.split("/")[0])

// The best baseline run's score: the most found across the parts, then in order.
function bestOf(runs: readonly RunRecord[]): ScoreSummary | undefined {
  const rank = ({ score }: RunRecord) =>
    PARTS.reduce((total, part) => total + found(score[part]), 0) + (score.inOrder ? 0.5 : 0)
  return runs.toSorted((a, b) => rank(b) - rank(a))[0]?.score
}

// Where the score falls short of the best baseline run's: each part with less found, and the
// order when the best kept it. A score as good or better says nothing.
function scoreChanges(score: ScoreSummary, runs: readonly RunRecord[]): string[] {
  const best = bestOf(runs)
  if (best === undefined) {
    return []
  }

  const short = PARTS.filter((part) => found(score[part]) < found(best[part]))
  return [
    ...short.map((part) => `${part} ${score[part]} (best ${best[part]})`),
    ...(best.inOrder && !score.inOrder ? ["out of order (best in order)"] : []),
  ]
}

// How far past the baseline runs' range a number may fall before it counts: two runs give a
// narrow range, and runs vary.
const MARGIN = 0.15

// Each number that falls well outside the baseline runs' range: "num_turns 52 (33–40)".
function numbersOutside(numbers: Record<string, number>, runs: readonly RunRecord[]): string[] {
  return Object.entries(numbers).flatMap(([name, value]) => {
    const seen = runs.flatMap((run) => {
      const number = name === "seconds" ? run.seconds : run.numbers[name]
      return number === undefined ? [] : [number]
    })
    if (seen.length === 0) {
      return []
    }

    const [low, high] = [Math.min(...seen), Math.max(...seen)]
    return value < low * (1 - MARGIN) || value > high * (1 + MARGIN)
      ? [`${name} ${String(value)} (${String(low)}–${String(high)})`]
      : []
  })
}

/**
 * A run against its fixture's baseline: ✓ when its score is as good as the best baseline run's and its time
 * and each watched number fall in or near the baseline's range; else what changed, and each
 * number well outside it.
 */
export function compareLine(
  run: RunRecord,
  entry: Baseline["fixtures"][string],
  watch: readonly string[],
): string {
  const watched = Object.entries(run.numbers).filter(([name]) => watch.includes(name))
  const changes = [
    ...scoreChanges(run.score, entry.runs),
    ...numbersOutside({ seconds: run.seconds, ...Object.fromEntries(watched) }, entry.runs),
  ]
  const at = `${String(entry.runs.length)} runs at ${entry.commit}`
  return changes.length === 0 ? `✓ as the baseline (${at})` : `✗ ${changes.join(" · ")}  (${at})`
}
