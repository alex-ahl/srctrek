import type { ResolvedChange, ResolvedRepo } from "../change/resolve"
import { PROMPT_HASH } from "../prompts"
import { FORMAT_VERSION, type Tour, type TourHeader, type TourStep } from "../schema/tour"
import { citationProblems } from "./citations"
import { type SubmittedStep, completeStep } from "./complete"

// The tour's record of a repo. The range names exact commits, since branches move on.
function tourRepo({ name, source, revision, range }: ResolvedRepo): Tour["repos"][number] {
  if (range === undefined) {
    return { name, source, revision }
  }

  return { name, source, revision, range: `${range.baseCommit}..${range.headCommit}` }
}

/** A tour being built: its header, and the steps added so far, each checked on the way in. */
export class TourDraft {
  readonly #steps: TourStep[] = []

  constructor(
    readonly change: ResolvedChange,
    private readonly header: TourHeader,
  ) {}

  get stepIds(): string[] {
    return this.#steps.map((step) => step.id)
  }

  // A step whose id is already in the draft takes its place, which is how a step is fixed.
  #put(step: TourStep): void {
    const index = this.#steps.findIndex((existing) => existing.id === step.id)
    if (index === -1) {
      this.#steps.push(step)
      return
    }

    this.#steps[index] = step
  }

  /** Checks the steps and adds them, all or none: when any has a problem, every problem. */
  async add(steps: SubmittedStep[]): Promise<string[]> {
    const perStep = await Promise.all(steps.map((step) => citationProblems(this.change, step)))
    const problems = perStep.flat()
    if (problems.length > 0) {
      return problems
    }

    const completed = await Promise.all(steps.map((step) => completeStep(this.change, step)))
    completed.forEach((step) => this.#put(step))

    return []
  }

  /** The tour as it stands; saving validates it as a whole. */
  toTour(now = new Date()): Tour {
    return {
      format_version: FORMAT_VERSION,
      created_at: now.toISOString(),
      prompt_hash: PROMPT_HASH,
      ...this.header,
      author: { role: "producer", ...this.header.author },
      repos: this.change.repos.map(tourRepo),
      steps: this.#steps,
    }
  }
}
