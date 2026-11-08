import type { ResolvedChange } from "../change/resolve"
import { blobAt } from "../git/read"
import { SubmittedStepSchema, type Trek, type TrekHeader, type TrekStep } from "../schema/trek"
import { citationProblems } from "./citations"
import { type Draft, addSteps, newDraft } from "./draft"

/** A step that can't be carried over to the change as it is now, and why. */
export type Redo = Readonly<{ step: TrekStep; why: string }>

/**
 * A stale trek brought to the change as it is now: a draft holding every step that still
 * holds, at the new revisions, and the steps to redo.
 */
export type CarriedOver = Readonly<{ draft: Draft; redo: readonly Redo[] }>

function headerOf(trek: Trek): TrekHeader {
  const { title, overview, trigger, outcome, sources } = trek
  const { agent, model } = trek.author
  const author = agent === undefined ? { model } : { agent, model }

  return { title, overview, trigger, outcome, sources, author }
}

// A cited file reads the same when its blob at the trek's revision is the one there now; a
// revision git no longer has counts as changed.
async function isUnchanged(
  trek: Trek,
  change: ResolvedChange,
  repo: string,
  file: string,
): Promise<boolean> {
  const before = trek.repos.find((recorded) => recorded.name === repo)?.revision
  const now = change.repos.find((resolved) => resolved.name === repo)
  if (before === undefined || now === undefined) {
    return false
  }

  const blobBefore = await blobAt(now.dir, before, file)
  return blobBefore !== undefined && blobBefore === (await blobAt(now.dir, now.revision, file))
}

// Why a step can't simply be kept: its repo isn't open, its file or a file it cites changed
// (lines it names may now hold other code), or a line it relies on is gone.
async function whyRedo(
  step: TrekStep,
  trek: Trek,
  change: ResolvedChange,
): Promise<string | undefined> {
  const repo = change.repos.find((resolved) => resolved.name === step.repo)
  if (repo === undefined) {
    return `${step.repo} isn't open; propose it again to bring this step back`
  }

  if ((await blobAt(repo.dir, repo.revision, step.file)) !== step.blob) {
    return `${step.file} changed`
  }

  for (const cite of step.via?.cites ?? []) {
    if (!(await isUnchanged(trek, change, cite.repo, cite.file))) {
      return `it cites ${cite.file}, which changed`
    }
  }

  return (await citationProblems(change, step))[0]
}

/** The steps of `trek` that still hold at the change as it is now, as a draft; the rest to redo. */
export async function carryOver(trek: Trek, change: ResolvedChange): Promise<CarriedOver> {
  const checked = await Promise.all(
    trek.steps.map(async (step) => ({ step, why: await whyRedo(step, trek, change) })),
  )
  const kept = checked.filter(({ why }) => why === undefined).map(({ step }) => step)
  const redo = checked.flatMap(({ step, why }) => (why === undefined ? [] : [{ step, why }]))

  // Kept steps are submitted again, so core stamps them with the new blobs and changed lines.
  const submitted = kept.map((step) => SubmittedStepSchema.parse(step))
  const { draft } = await addSteps(newDraft(change, headerOf(trek)), submitted)
  const order = trek.steps.map((step) => step.id)

  return { draft: { ...draft, order }, redo }
}
