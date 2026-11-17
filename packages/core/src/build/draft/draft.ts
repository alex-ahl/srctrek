import { recordedRange } from "../../schema/recorded-range"
import { rangeHead } from "../../change/head"
import { type ResolvedChange, type ResolvedRepo, hasRange } from "../../change/resolve"
import { PROMPT_HASH } from "../../prompts/texts"
import { FORMAT_VERSION, type Trek, type TrekHeader, type TrekStep } from "../../schema/trek"
import { citationProblems } from "./citations"
import { type SubmittedStep, completeStep } from "./complete"

/** A trek being built: the change, its header, and the steps so far, each checked on the way in. */
export type Draft = Readonly<{
  change: ResolvedChange
  header: TrekHeader
  steps: readonly TrekStep[]
  // an updated trek's step order, so a redone step goes back where it was; others follow
  order?: readonly string[] | undefined
}>

/** A draft after steps were offered: unchanged with the problems, or with the steps added. */
export type Added = Readonly<{ draft: Draft; problems: readonly string[] }>

export function newDraft(change: ResolvedChange, header: TrekHeader): Draft {
  return { change, header, steps: [] }
}

/** The draft over a change with more repos on its route, its steps kept. */
export function withChange(draft: Draft, change: ResolvedChange): Draft {
  return { ...draft, change }
}

// A step whose id is already in the draft takes its place, which is how a step is fixed.
function withStep(steps: readonly TrekStep[], step: TrekStep): readonly TrekStep[] {
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

// Where a step goes: its place in an updated trek's order; steps not in it after, as added.
function rank(order: readonly string[], id: string): number {
  const place = order.indexOf(id)
  return place === -1 ? order.length : place
}

/** The steps in trek order: as added, unless the draft keeps an updated trek's order. */
export function orderedSteps({ steps, order }: Draft): TrekStep[] {
  if (order === undefined) {
    return [...steps]
  }

  return steps.toSorted((a, b) => rank(order, a.id) - rank(order, b.id))
}

export function stepIds(draft: Draft): string[] {
  return orderedSteps(draft).map((step) => step.id)
}

// The trek's record of a repo. The range names exact commits, since branches move on; its head
// names the branch or pull request, to compare those commits with later.
async function trekRepo(repo: ResolvedRepo): Promise<Trek["repos"][number]> {
  const { name, source, revision } = repo
  if (!hasRange(repo)) {
    return { name, source, revision }
  }

  const { baseCommit, headCommit } = repo.range
  return {
    name,
    source,
    revision,
    range: recordedRange(baseCommit, headCommit),
    head: await rangeHead(repo),
  }
}

/** The trek as the draft stands; saving validates it as a whole. */
export async function draftToTrek(draft: Draft, now = new Date()): Promise<Trek> {
  return {
    format_version: FORMAT_VERSION,
    created_at: now.toISOString(),
    prompt_hash: PROMPT_HASH,
    ...draft.header,
    author: { role: "producer", ...draft.header.author },
    repos: await Promise.all(draft.change.repos.map(trekRepo)),
    steps: orderedSteps(draft),
  }
}
