import {
  BUILD_STOPPED,
  type ResolvedChange,
  type ResolvedRepo,
  type SubmittedStep,
  type Tour,
  type TourHeader,
  TourDraft,
  TourValidationError,
  directoryIn,
  readChangeArguments,
  repoNamed,
  resolveChange,
  saveChangedLines,
  saveTour,
} from "@codetrail/core"

// Rejected rounds a draft may take before its build stops, so an agent can't loop on it.
const MAX_REJECTED_ROUNDS = 3

/** The change a tour is being built for, and the tour so far. Each tool needs the one before. */
export class TrailSession {
  #change: ResolvedChange | undefined
  #draft: TourDraft | undefined
  #rejectedRounds = 0

  constructor(
    private readonly cwd: string,
    private readonly cacheDir?: string,
  ) {}

  #openChange(): ResolvedChange {
    if (this.#change === undefined) {
      throw new Error("no change is open: call open_change first")
    }

    return this.#change
  }

  #openDraft(): TourDraft {
    if (this.#draft === undefined) {
      throw new Error("no tour is started: call start_tour first")
    }

    return this.#draft
  }

  async open(args: string[]): Promise<ResolvedChange> {
    const read = readChangeArguments(args, directoryIn(this.cwd))
    this.#change = await resolveChange(this.cwd, read, this.cacheDir)
    this.#draft = undefined

    return this.#change
  }

  repo(name: string): ResolvedRepo {
    return repoNamed(this.#openChange(), name)
  }

  start(header: TourHeader): void {
    this.#draft = new TourDraft(this.#openChange(), header)
    this.#rejectedRounds = 0
  }

  // Counts a rejected round; the last one allowed drops the draft and says the build stopped.
  #reject(problems: string[]): string[] {
    this.#rejectedRounds += 1
    if (this.#rejectedRounds < MAX_REJECTED_ROUNDS) {
      return problems
    }

    this.#draft = undefined
    return [...problems, "", BUILD_STOPPED]
  }

  /** The problems with the steps; none when they were added. */
  async addSteps(steps: SubmittedStep[]): Promise<string[]> {
    const problems = await this.#openDraft().add(steps)

    return problems.length === 0 ? [] : this.#reject(problems)
  }

  stepIds(): string[] {
    return this.#openDraft().stepIds
  }

  // A tour that fails the whole-tour rules is a rejected round, like steps that fail theirs.
  async #save(name: string, tour: Tour): Promise<string> {
    try {
      return await saveTour(this.cwd, name, tour)
    } catch (error) {
      if (error instanceof TourValidationError) {
        throw new Error(this.#reject([error.message]).join("\n"), { cause: error })
      }

      throw error
    }
  }

  /** Saves the tour under `.codetrail/tours`, with its changed lines beside it; its path. */
  async finish(name: string): Promise<string> {
    const draft = this.#openDraft()
    const tour = draft.toTour()

    const path = await this.#save(name, tour)
    await saveChangedLines(draft.change, tour, path)
    this.#draft = undefined

    return path
  }
}
