import { writeFile } from "node:fs/promises"
import { type RepoWithRange, type ResolvedChange, hasRange } from "../change/resolve"
import { type LineChange, changedLines } from "../git/diff"
import type { Trek } from "../schema/trek"

type LinesByFile = Record<string, Record<string, string>>

/** Changed lines by repo, file, and line number, as the Neovim plugin reads them. */
export type ChangedLinesFile = Record<string, LinesByFile>

function filesVisited(trek: Trek, repo: string): string[] {
  const files = trek.steps.filter((step) => step.repo === repo).map((step) => step.file)

  return [...new Set(files)]
}

function asRecord(lines: Map<number, LineChange>): Record<string, string> {
  return Object.fromEntries([...lines].map(([line, kind]) => [String(line), kind]))
}

async function linesOfFiles(repo: RepoWithRange, files: string[]): Promise<LinesByFile> {
  const { baseCommit, headCommit } = repo.range
  const entries = await Promise.all(
    files.map(async (file): Promise<[string, Record<string, string>]> => {
      const lines = await changedLines(repo.dir, baseCommit, headCommit, file)
      return [file, asRecord(lines)]
    }),
  )

  return Object.fromEntries(entries)
}

/** Writes the changed-lines file beside a saved trek: `<name>.changed.json`. */
export async function saveChangedLines(
  change: ResolvedChange,
  trek: Trek,
  trekPath: string,
): Promise<void> {
  const repos = change.repos.filter(hasRange)
  const entries = await Promise.all(
    repos.map(async (repo): Promise<[string, LinesByFile]> => {
      const files = await linesOfFiles(repo, filesVisited(trek, repo.name))
      return [repo.name, files]
    }),
  )
  const file: ChangedLinesFile = Object.fromEntries(entries)

  await writeFile(trekPath.replace(/\.json$/, ".changed.json"), JSON.stringify(file) + "\n")
}
