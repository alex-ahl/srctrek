import type { ResolvedChange } from "../change/resolve"
import { readFileAt } from "../git/read"
import { splitLines } from "../read/files"
import { describeRepo } from "../read/repo"
import type { TourStep } from "../schema/tour"
import type { SubmittedStep } from "./complete"

// A line the step relies on, and how the step relies on it.
type Place = { repo: string; file: string; line: number; how: "ends at" | "cites" }

// What's wrong with one place, if anything: an unknown repo, a missing file, or a line past
// the file's end.
async function placeProblem(change: ResolvedChange, place: Place): Promise<string | undefined> {
  const repo = change.repos.find((candidate) => candidate.name === place.repo)
  if (repo === undefined) {
    return `${place.how} repo ${place.repo}, which isn't in the change`
  }

  const text = await readFileAt(repo.dir, repo.revision, place.file)
  if (text === undefined) {
    return `${place.how} ${place.file}, which isn't in ${describeRepo(repo)}`
  }

  const lastLine = splitLines(text).length
  if (place.line > lastLine) {
    return `${place.how} ${place.repo}/${place.file}:${place.line}, past its last line (${lastLine})`
  }

  return undefined
}

// Every place the step relies on: its own last line (the first is no later), then each piece
// of evidence.
function placesOf(step: SubmittedStep | TourStep): Place[] {
  const own: Place = { repo: step.repo, file: step.file, line: step.end_line, how: "ends at" }
  const evidence = (step.via?.cites ?? []).map((cite): Place => ({ ...cite, how: "cites" }))

  return [own, ...evidence]
}

/**
 * Lines a step cites that don't exist at their repo's revision, each as a message naming the
 * step, for the agent to fix. None when every citation holds.
 */
export async function citationProblems(
  change: ResolvedChange,
  step: SubmittedStep | TourStep,
): Promise<string[]> {
  const problems = await Promise.all(placesOf(step).map((place) => placeProblem(change, place)))

  return problems
    .filter((problem) => problem !== undefined)
    .map((problem) => `${step.id}: ${problem}`)
}
