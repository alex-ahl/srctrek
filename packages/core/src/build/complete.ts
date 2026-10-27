import type { ResolvedChange, ResolvedRepo } from "../change/resolve"
import { changedLines } from "../git/diff"
import { blobAt } from "../git/read"
import { describeRepo, repoNamed } from "../read/repo"
import type { TourStep } from "../schema/tour"

/** A step as the agent submits it: everything but what core works out from git. */
export type SubmittedStep = Omit<TourStep, "blob" | "changed">

// Whether the change touches any of the step's lines; a repo on the route unchanged never does.
async function touchesChange(repo: ResolvedRepo, step: SubmittedStep): Promise<boolean> {
  if (repo.range === undefined) {
    return false
  }

  const { baseCommit, headCommit } = repo.range
  const lines = await changedLines(repo.dir, baseCommit, headCommit, step.file)

  return [...lines.keys()].some((line) => line >= step.start_line && line <= step.end_line)
}

/** The step with its file's blob at the repo's revision and whether the change touches it. */
export async function completeStep(change: ResolvedChange, step: SubmittedStep): Promise<TourStep> {
  const repo = repoNamed(change, step.repo)
  const blob = await blobAt(repo.dir, repo.revision, step.file)
  if (blob === undefined) {
    throw new Error(`${step.id}: no file ${step.file} in ${describeRepo(repo)}`)
  }

  return { ...step, blob, changed: await touchesChange(repo, step) }
}
