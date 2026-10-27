import type { ResolvedRepo } from "../change/resolve"
import { readFileAt } from "../git/read"
import { runGit } from "../git/run"
import { describeRepo, pathsUnder } from "./repo"

/** A run of a file's lines; `start` is the number of the first. */
export type NumberedLines = { path: string; start: number; lines: string[] }

/** The repo's files at its revision, or only those under `folder`. */
export async function listFiles(repo: ResolvedRepo, folder?: string): Promise<string[]> {
  const args = ["ls-tree", "-r", "--name-only", "-z", repo.revision, ...pathsUnder(folder)]
  const out = await runGit(repo.dir, args)

  return out.split("\0").filter(Boolean)
}

// A file's lines; the newline that ends the last one doesn't start another.
function splitLines(text: string): string[] {
  return text.replace(/\n$/, "").split("\n")
}

/** Lines `from` to `to` (inclusive) of a file at the repo's revision; the whole file by default. */
export async function readLines(
  repo: ResolvedRepo,
  path: string,
  from = 1,
  to?: number,
): Promise<NumberedLines> {
  const text = await readFileAt(repo.dir, repo.revision, path)
  if (text === undefined) {
    throw new Error(`no file ${path} in ${describeRepo(repo)}`)
  }

  // Line n is at index n - 1; slice stops before its end index, so `to` is included.
  const lines = splitLines(text).slice(from - 1, to)

  return { path, start: from, lines }
}
