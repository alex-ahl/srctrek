import type { Tour, TourStep } from "@codetrail/core"
import type { Expected, ExpectedLine } from "./expected"

type RouteEntry = Expected["route"][number]
type Link = Expected["links"][number]
type Place = { repo: string; file: string }

/** How a tour reached one expected link: cited as the fixture does, guessed, or not at all. */
export type LinkFound = "cited" | "cited, guessed" | "guessed" | "no evidence" | "not reached"

/** How a tour measures up to what its fixture expects. */
export type Score = {
  route: { found: number; total: number; inOrder: boolean; missing: RouteEntry[] }
  links: { link: Link; found: LinkFound }[]
  bugs: { summary: string; inSteps: number; total: number }[]
}

function inFile(at: Place, place: Place): boolean {
  return at.repo === place.repo && at.file === place.file
}

function overlaps(step: TourStep, entry: RouteEntry): boolean {
  const [start, end] = entry.lines

  return inFile(step, entry) && step.start_line <= end && step.end_line >= start
}

function covers(step: TourStep, line: ExpectedLine): boolean {
  return inFile(step, line) && step.start_line <= line.line && line.line <= step.end_line
}

// Each entry is met at or after the step that met the one before: one step may cover two
// entries, and a file the route visits twice is found again further on.
function isWalkedInOrder(steps: TourStep[], entries: RouteEntry[]): boolean {
  let from = 0
  for (const entry of entries) {
    const index = steps.findIndex((step, i) => i >= from && overlaps(step, entry))
    if (index === -1) {
      return false
    }

    from = index
  }

  return true
}

function scoreRoute(steps: TourStep[], route: RouteEntry[]): Score["route"] {
  const isReached = (entry: RouteEntry) => steps.some((step) => overlaps(step, entry))
  const reached = route.filter(isReached)

  return {
    found: reached.length,
    total: route.length,
    inOrder: isWalkedInOrder(steps, reached),
    missing: route.filter((entry) => !isReached(entry)),
  }
}

// The steps from the link's start to its target, in tour order: the evidence may be cited on
// any of them, such as on a hop into the target's repo. A tour that never visits the start is
// read from its first step.
function stepsAcross(steps: TourStep[], link: Link): TourStep[] {
  const start = steps.findIndex((step) => inFile(step, link.from))
  const end = steps.findIndex((step) => inFile(step, link.to))

  return steps.slice(Math.max(start, 0), end + 1)
}

// Cited when a step on the way cites a file the fixture names as evidence, the exact line left
// to the reader; guessed when a step on the way says it matched by name, which may be both.
function linkFound(steps: TourStep[], link: Link): LinkFound {
  if (!steps.some((step) => inFile(step, link.to))) {
    return "not reached"
  }

  const across = stepsAcross(steps, link)
  const cites = across.flatMap((step) => step.via?.cites ?? [])
  const cited = cites.some((cite) => link.evidence.some((evidence) => inFile(cite, evidence)))
  const guessed = across.some((step) => step.via?.guessed)
  if (cited) {
    return guessed ? "cited, guessed" : "cited"
  }

  return guessed ? "guessed" : "no evidence"
}

/** Scores `tour` against what its fixture expects. */
export function scoreTour(tour: Tour, expected: Expected): Score {
  const { steps } = tour

  return {
    route: scoreRoute(steps, expected.route),
    links: expected.links.map((link) => ({ link, found: linkFound(steps, link) })),
    bugs: expected.bugs.map((bug) => ({
      summary: bug.summary,
      inSteps: bug.files.filter((line) => steps.some((step) => covers(step, line))).length,
      total: bug.files.length,
    })),
  }
}
