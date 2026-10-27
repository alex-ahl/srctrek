import { writeFile } from "node:fs/promises"
import type { ResolvedChange, ResolvedRepo } from "../change/resolve"
import { type LineChange, changedLines } from "../git/diff"
import type { ResolvedRange } from "../git/range"
import type { Tour } from "../schema/tour"

type LinesByFile = Record<string, Record<string, string>>

/** Changed lines by repo, file, and line number, as the Neovim plugin reads them. */
export type ChangedLinesFile = Record<string, LinesByFile>

type ChangedRepo = ResolvedRepo & { range: ResolvedRange }

function isChanged(repo: ResolvedRepo): repo is ChangedRepo {
  return repo.range !== undefined
}

function filesVisited(tour: Tour, repo: string): string[] {
  const files = tour.steps.filter((step) => step.repo === repo).map((step) => step.file)

  return [...new Set(files)]
}

function asRecord(lines: Map<number, LineChange>): Record<string, string> {
  return Object.fromEntries([...lines].map(([line, kind]) => [String(line), kind]))
}

async function linesOfFiles(repo: ChangedRepo, files: string[]): Promise<LinesByFile> {
  const { baseCommit, headCommit } = repo.range
  const entries = await Promise.all(
    files.map(async (file): Promise<[string, Record<string, string>]> => {
      const lines = await changedLines(repo.dir, baseCommit, headCommit, file)
      return [file, asRecord(lines)]
    }),
  )

  return Object.fromEntries(entries)
}

/** Writes the changed-lines file beside a saved tour: `<name>.changed.json`. */
export async function saveChangedLines(
  change: ResolvedChange,
  tour: Tour,
  tourPath: string,
): Promise<void> {
  const repos = change.repos.filter(isChanged)
  const entries = await Promise.all(
    repos.map(async (repo): Promise<[string, LinesByFile]> => {
      const files = await linesOfFiles(repo, filesVisited(tour, repo.name))
      return [repo.name, files]
    }),
  )
  const file: ChangedLinesFile = Object.fromEntries(entries)

  await writeFile(tourPath.replace(/\.json$/, ".changed.json"), JSON.stringify(file) + "\n")
}
