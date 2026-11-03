import { type Tour, type TourStep, folderName, parseRepoEntry } from "@codetrail/core"
import type { Expected, ExpectedLine } from "./expected"
import { covers, inFile } from "./places"
import { type StackCheck, checkStacks } from "./stacks"

type RouteEntry = Expected["route"][number]
type Link = Expected["links"][number]

/** How a tour reached one expected link: cited as the fixture does, guessed, or not at all. */
export type LinkFound = "cited" | "cited, guessed" | "guessed" | "no evidence" | "not reached"

type Severity = "high" | "medium" | "low"

/** The strongest flag on the steps covering a bug's line; a bug is found when one is high. */
export type LineFlag = Severity | "unflagged" | "not in a step"

/** How a tour measures up to what its fixture expects. */
export type Score = {
  // found and total count the entries a tour must reach; skipped are optional ones it left out
  route: {
    found: number
    total: number
    inOrder: boolean
    missing: RouteEntry[]
    skipped: RouteEntry[]
  }
  links: { link: Link; found: LinkFound }[]
  bugs: { summary: string; lines: LineFlag[] }[]
  stacks: StackCheck[]
  // how many of the tour's steps carry a flag, by severity
  flags: { steps: number } & Record<Severity, number>
  // the fixture's decoy repos the tour stepped into, and how many steps each
  decoys: { repo: string; steps: number }[]
}

const SEVERITIES: Severity[] = ["high", "medium", "low"]

function overlaps(step: TourStep, entry: RouteEntry): boolean {
  const [start, end] = entry.lines

  return inFile(step, entry) && step.start_line <= end && step.end_line >= start
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
  const required = route.filter((entry) => entry.optional !== true)
  const notReached = route.filter((entry) => !isReached(entry))

  return {
    found: required.filter(isReached).length,
    total: required.length,
    inOrder: isWalkedInOrder(steps, route.filter(isReached)),
    missing: notReached.filter((entry) => entry.optional !== true),
    skipped: notReached.filter((entry) => entry.optional === true),
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

// The flags over a step's lines: its own, and for a context step those of the step it explains,
// which the reader opens it from.
function flagsOver(steps: TourStep[], step: TourStep): (Severity | undefined)[] {
  const explained = step.kind === "context" ? steps.find((s) => s.id === step.for) : undefined

  return [step.uncertain?.severity, explained?.uncertain?.severity]
}

function lineFlag(steps: TourStep[], line: ExpectedLine): LineFlag {
  const covering = steps.filter((step) => covers(step, line))
  if (covering.length === 0) {
    return "not in a step"
  }

  const severities = covering.flatMap((step) => flagsOver(steps, step))

  return SEVERITIES.find((severity) => severities.includes(severity)) ?? "unflagged"
}

function countFlags(steps: TourStep[]): Score["flags"] {
  const flagged = (severity: Severity) =>
    steps.filter((step) => step.uncertain?.severity === severity).length

  return {
    steps: steps.length,
    high: flagged("high"),
    medium: flagged("medium"),
    low: flagged("low"),
  }
}

// The fixture folder a tour's repo was read from: the one trail ran in for ".", else the last
// part of its source, so a repo the agent named "payments" is scored as "pay-backend".
function folderOf(source: string, ranIn: string): string {
  return source === "." ? ranIn : folderName(parseRepoEntry(source).source)
}

// The tour's steps with every repo, theirs and their cites', named by its fixture folder.
function stepsByFolder(tour: Tour, ranIn: string): TourStep[] {
  const folders = new Map(tour.repos.map((repo) => [repo.name, folderOf(repo.source, ranIn)]))
  const folder = (name: string) => folders.get(name) ?? name

  return tour.steps.map((step) => ({
    ...step,
    repo: folder(step.repo),
    via: step.via && {
      ...step.via,
      cites: step.via.cites.map((cite) => ({ ...cite, repo: folder(cite.repo) })),
    },
  }))
}

function decoysVisited(steps: TourStep[], decoys: string[]): Score["decoys"] {
  return decoys.flatMap((repo) => {
    const visits = steps.filter((step) => step.repo === repo).length
    return visits > 0 ? [{ repo, steps: visits }] : []
  })
}

/** Scores `tour`, built from `ranIn`, against what its fixture expects. */
export function scoreTour(tour: Tour, expected: Expected, ranIn = expected.run.in): Score {
  const steps = stepsByFolder(tour, ranIn)

  return {
    route: scoreRoute(steps, expected.route),
    links: expected.links.map((link) => ({ link, found: linkFound(steps, link) })),
    bugs: expected.bugs.map((bug) => ({
      summary: bug.summary,
      lines: bug.files.map((line) => lineFlag(steps, line)),
    })),
    stacks: checkStacks(steps, expected.stacks),
    flags: countFlags(steps),
    decoys: decoysVisited(steps, expected.decoys),
  }
}
