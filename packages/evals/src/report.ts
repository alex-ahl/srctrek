import { agentNumbers } from "./agent-numbers"
import type { LineFlag, LinkFound, Score } from "./score"

type RouteEntry = Score["route"]["missing"][number]

/** What a run took, besides the tour: how long, and what the agent said last. */
export type RunFacts = {
  seconds: number
  steps: number
  agentSummary: string
  log: string
  tour: string
}

const LABEL_WIDTH = 8

// Each line of a section under its label, the label only on the first.
function section(label: string, lines: string[]): string[] {
  return lines.map((line, i) => (i === 0 ? label : "").padEnd(LABEL_WIDTH) + line)
}

function mark(ok: boolean): string {
  return ok ? "✓" : "✗"
}

// A name match is a judgement the reader can check; no evidence, or never getting there,
// is a miss.
function linkOk(found: LinkFound): boolean {
  return found !== "no evidence" && found !== "not reached"
}

function routeLines(route: Score["route"]): string[] {
  const order = route.inOrder ? "in order" : "out of order"
  const place = (entry: RouteEntry) => `${entry.repo} ${entry.file} ${entry.lines.join("–")}`
  const missing = route.missing.map((entry) => `✗ ${place(entry)}`)
  const skipped = route.skipped.map((entry) => `· ${place(entry)} (optional, skipped)`)

  return [`${route.found}/${route.total} reached, ${order}`, ...missing, ...skipped]
}

function linkLines(links: Score["links"]): string[] {
  const ends = links.map(
    ({ link }) => `${link.from.repo} ${link.from.file} → ${link.to.repo} ${link.to.file}`,
  )
  const width = Math.max(...ends.map((end) => end.length))

  return links.map(({ found }, i) => `${mark(linkOk(found))} ${ends[i]?.padEnd(width)}  ${found}`)
}

// "medium 1, unflagged 2": how the lines not flagged high fell short.
function shortfall(lines: LineFlag[]): string {
  const counts = Map.groupBy(lines, (flag) => flag)
  counts.delete("high")

  return [...counts].map(([flag, group]) => `${flag} ${group.length}`).join(", ")
}

function bugLines(bugs: Score["bugs"]): string[] {
  return bugs.map((bug) => {
    const high = bug.lines.filter((flag) => flag === "high").length
    const rest = shortfall(bug.lines)
    const counts = rest === "" ? "" : ` (${rest})`

    return `${mark(high > 0)} high on ${high}/${bug.lines.length} lines${counts}  ${bug.summary}`
  })
}

function flagLines({ steps, high, medium, low }: Score["flags"]): string[] {
  const flagged = high + medium + low

  return [`${flagged}/${steps} steps: ${high} high, ${medium} medium, ${low} low`]
}

/** The eval's report: the score, then what the run took. */
export function formatReport(name: string, score: Score, facts: RunFacts): string {
  return [
    `${name} · ${facts.steps} steps · ${facts.seconds} s`,
    "",
    ...section("Route", routeLines(score.route)),
    ...section("Links", linkLines(score.links)),
    ...section("Bugs", bugLines(score.bugs)),
    ...section("Flags", flagLines(score.flags)),
    "",
    ...section("Agent", agentNumbers(facts.agentSummary)),
    ...section("Tour", [facts.tour]),
    ...section("Log", [facts.log]),
  ].join("\n")
}
