import type { ResolvedChange, ResolvedRepo } from "../change/resolve"
import { PROMPT_HASH } from "../prompts"
import { FORMAT_VERSION, type Tour, type TourHeader, type TourStep } from "../schema/tour"
import { citationProblems } from "./citations"
import { type SubmittedStep, completeStep } from "./complete"

/** A tour being built: the change, its header, and the steps so far, each checked on the way in. */
export type Draft = Readonly<{
  change: ResolvedChange
  header: TourHeader
  steps: readonly TourStep[]
}>

/** A draft after steps were offered: unchanged with the problems, or with the steps added. */
export type Added = Readonly<{ draft: Draft; problems: readonly string[] }>

export function newDraft(change: ResolvedChange, header: TourHeader): Draft {
  return { change, header, steps: [] }
}

// A step whose id is already in the draft takes its place, which is how a step is fixed.
function withStep(steps: readonly TourStep[], step: TourStep): readonly TourStep[] {
  const replaces = steps.some((existing) => existing.id === step.id)
  if (!replaces) {
    return [...steps, step]
  }

  return steps.map((existing) => (existing.id === step.id ? step : existing))
}

/** Checks the steps and adds them, all or none: when any has a problem, every problem. */
export async function addSteps(draft: Draft, steps: SubmittedStep[]): Promise<Added> {
  const perStep = await Promise.all(steps.map((step) => citationProblems(draft.change, step)))
  const problems = perStep.flat()
  if (problems.length > 0) {
    return { draft, problems }
  }

  const completed = await Promise.all(steps.map((step) => completeStep(draft.change, step)))

  return { draft: { ...draft, steps: completed.reduce(withStep, draft.steps) }, problems: [] }
}

export function stepIds(draft: Draft): string[] {
  return draft.steps.map((step) => step.id)
}

// The tour's record of a repo. The range names exact commits, since branches move on.
function tourRepo({ name, source, revision, range }: ResolvedRepo): Tour["repos"][number] {
  if (range === undefined) {
    return { name, source, revision }
  }

  return { name, source, revision, range: `${range.baseCommit}..${range.headCommit}` }
}

/** The tour as the draft stands; saving validates it as a whole. */
export function draftToTour(draft: Draft, now = new Date()): Tour {
  return {
    format_version: FORMAT_VERSION,
    created_at: now.toISOString(),
    prompt_hash: PROMPT_HASH,
    ...draft.header,
    author: { role: "producer", ...draft.header.author },
    repos: draft.change.repos.map(tourRepo),
    steps: [...draft.steps],
  }
}
