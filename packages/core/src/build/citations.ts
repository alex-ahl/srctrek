import type { ResolvedChange } from "../change/resolve"
import { readFileAt } from "../git/read"
import { splitLines } from "../read/files"
import { describeRepo } from "../read/repo"
import type { TourStep } from "../schema/tour"
import type { SubmittedStep } from "./complete"

/**
 * A line something relies on, and how it relies on it: "starts at", "cites", "puts total
 * on", and so on.
 */
export type Place = { repo: string; file: string; line: number; how: string }

/**
 * What's wrong with one place, if anything: an unknown repo, a missing file, a line past the
 * file's end, or a blank line, which is what a line number off by one usually lands on.
 */
export async function placeProblem(
  change: ResolvedChange,
  place: Place,
): Promise<string | undefined> {
  const repo = change.repos.find((candidate) => candidate.name === place.repo)
  if (repo === undefined) {
    return `${place.how} repo ${place.repo}, which isn't in the change`
  }

  const text = await readFileAt(repo.dir, repo.revision, place.file)
  if (text === undefined) {
    return `${place.how} ${place.file}, which isn't in ${describeRepo(repo)}`
  }

  const lines = splitLines(text)
  const where = `${place.repo}/${place.file}:${place.line}`
  if (place.line > lines.length) {
    return `${place.how} ${where}, past its last line (${lines.length})`
  }

  if (lines[place.line - 1]?.trim() === "") {
    return `${place.how} ${where}, which is blank`
  }

  return undefined
}

// Every place the step relies on: where it starts and ends, each piece of evidence, and the
// line of each predicted value.
function placesOf(step: SubmittedStep | TourStep): Place[] {
  const at = (line: number, how: string): Place => ({ repo: step.repo, file: step.file, line, how })
  const range = [at(step.start_line, "starts at"), at(step.end_line, "ends at")]
  const evidence = (step.via?.cites ?? []).map((cite): Place => ({ ...cite, how: "cites" }))
  const values = (step.predicted_values ?? []).map((value) =>
    at(value.line, `puts ${value.name} on`),
  )

  return [...range, ...evidence, ...values]
}

/**
 * Lines a step relies on that don't exist at their repo's revision, or are blank, each as a
 * message naming the step, for the agent to fix. None when every one holds.
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
