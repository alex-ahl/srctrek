import type { ResolvedChange } from "../../change/resolve"
import { blobAt } from "../../git/read"
import type { Trek, TrekStep } from "../../schema/trek"

// Whether the step's file has changed at the repo's revision now: another blob, or gone. A repo
// the change no longer opens, such as one proposed but never added, can't be checked.
async function isStale(step: TrekStep, change: ResolvedChange): Promise<boolean> {
  const repo = change.repos.find((candidate) => candidate.name === step.repo)
  if (repo === undefined) {
    return false
  }

  return (await blobAt(repo.dir, repo.revision, step.file)) !== step.blob
}

/** The ids of a trek's steps whose file has changed at the change's revisions now, or gone. */
export async function staleStepIds(trek: Trek, change: ResolvedChange): Promise<string[]> {
  const ids = await Promise.all(
    trek.steps.map(async (step) => ((await isStale(step, change)) ? [step.id] : [])),
  )

  return ids.flat()
}
