import {
  type ResolvedChange,
  type ResolvedRepo,
  type SubmittedStep,
  type TourHeader,
  TourDraft,
  directoryIn,
  readChangeArguments,
  repoNamed,
  resolveChange,
  saveChangedLines,
  saveTour,
} from "@codetrail/core"

/** The change a tour is being built for, and the tour so far. Each tool needs the one before. */
export class TrailSession {
  #change: ResolvedChange | undefined
  #draft: TourDraft | undefined

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
  }

  /** The problems with the steps; none when they were added. */
  addSteps(steps: SubmittedStep[]): Promise<string[]> {
    return this.#openDraft().add(steps)
  }

  stepIds(): string[] {
    return this.#openDraft().stepIds
  }

  /** Saves the tour under `.codetrail/tours`, with its changed lines beside it; its path. */
  async finish(name: string): Promise<string> {
    const draft = this.#openDraft()
    const tour = draft.toTour()

    const path = await saveTour(this.cwd, name, tour)
    await saveChangedLines(draft.change, tour, path)
    this.#draft = undefined

    return path
  }
}
