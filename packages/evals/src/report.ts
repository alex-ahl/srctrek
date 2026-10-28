import { agentNumbers } from "./agent-numbers"
import type { LinkFound, Score } from "./score"

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
  const missing = route.missing.map(
    (entry) => `✗ ${entry.repo} ${entry.file} ${entry.lines.join("–")}`,
  )

  return [`${route.found}/${route.total} reached, ${order}`, ...missing]
}

function linkLines(links: Score["links"]): string[] {
  const ends = links.map(
    ({ link }) => `${link.from.repo} ${link.from.file} → ${link.to.repo} ${link.to.file}`,
  )
  const width = Math.max(...ends.map((end) => end.length))

  return links.map(({ found }, i) => `${mark(linkOk(found))} ${ends[i]?.padEnd(width)}  ${found}`)
}

function bugLines(bugs: Score["bugs"]): string[] {
  return bugs.map(
    (bug) => `${mark(bug.inSteps === bug.total)} ${bug.inSteps}/${bug.total} lines  ${bug.summary}`,
  )
}

/** The eval's report: the score, then what the run took. */
export function formatReport(name: string, score: Score, facts: RunFacts): string {
  return [
    `${name} · ${facts.steps} steps · ${facts.seconds} s`,
    "",
    ...section("Route", routeLines(score.route)),
    ...section("Links", linkLines(score.links)),
    ...section("Bugs", bugLines(score.bugs)),
    "",
    ...section("Agent", agentNumbers(facts.agentSummary)),
    ...section("Tour", [facts.tour]),
    ...section("Log", [facts.log]),
  ].join("\n")
}
