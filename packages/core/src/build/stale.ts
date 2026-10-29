import type { ResolvedChange } from "../change/resolve"
import { blobAt } from "../git/read"
import type { Tour, TourStep } from "../schema/tour"

// Whether the step's file is the same at the repo's revision now: same blob, or gone. A repo
// the change no longer opens, such as one proposed but never added, can't be checked.
async function isStale(step: TourStep, change: ResolvedChange): Promise<boolean> {
  const repo = change.repos.find((candidate) => candidate.name === step.repo)
  if (repo === undefined) {
    return false
  }

  return (await blobAt(repo.dir, repo.revision, step.file)) !== step.blob
}

/** The ids of a tour's steps whose file has changed at the change's revisions now, or gone. */
export async function staleStepIds(tour: Tour, change: ResolvedChange): Promise<string[]> {
  const ids = await Promise.all(
    tour.steps.map(async (step) => ((await isStale(step, change)) ? [step.id] : [])),
  )

  return ids.flat()
}
