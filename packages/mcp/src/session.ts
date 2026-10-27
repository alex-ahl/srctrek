import {
  type ResolvedChange,
  type ResolvedRepo,
  directoryIn,
  readChangeArguments,
  repoNamed,
  resolveChange,
} from "@codetrail/core"

/** The change a tour is being built for. The read tools need it opened first. */
export class TrailSession {
  #change: ResolvedChange | undefined

  constructor(
    private readonly cwd: string,
    private readonly cacheDir?: string,
  ) {}

  async open(args: string[]): Promise<ResolvedChange> {
    const read = readChangeArguments(args, directoryIn(this.cwd))
    this.#change = await resolveChange(this.cwd, read, this.cacheDir)

    return this.#change
  }

  repo(name: string): ResolvedRepo {
    if (this.#change === undefined) {
      throw new Error("no change is open: call open_change first")
    }

    return repoNamed(this.#change, name)
  }
}
