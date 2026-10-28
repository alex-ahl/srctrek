import type { ResolvedRepo } from "../change/resolve"
import { readFileAt } from "../git/read"
import { runGit } from "../git/run"
import { describeRepo, pathsUnder } from "./repo"

/** A run of a file's lines; `start` is the number of the first, `total` the file's count. */
export type NumberedLines = { path: string; start: number; lines: string[]; total: number }

/** Paths listed, at most a few hundred; `truncated` when there were more. */
export type Listing = { paths: string[]; truncated: boolean }

// Enough to see a folder's shape; a closer look narrows the folder.
const LIST_LIMIT = 500

// Without `to`, a read stops after this many lines, so one huge file can't flood the reader.
const READ_LIMIT = 400

// "100644 blob <id>\tsrc/app.ts": the path, with a trailing "/" for a folder.
function entryPath(record: string): string {
  const [meta = "", path = ""] = record.split("\t")
  return meta.includes(" tree ") ? `${path}/` : path
}

// A folder's own entries, files and folders, without what's inside the folders.
async function oneLevel(repo: ResolvedRepo, folder: string | undefined): Promise<string[]> {
  const inside = folder === undefined ? [] : ["--", `${folder.replace(/\/$/, "")}/`]
  const out = await runGit(repo.dir, ["ls-tree", "-z", repo.revision, ...inside])

  return out.split("\0").filter(Boolean).map(entryPath)
}

async function everyFile(repo: ResolvedRepo, folder: string | undefined): Promise<string[]> {
  const args = ["ls-tree", "-r", "--name-only", "-z", repo.revision, ...pathsUnder(folder)]
  const out = await runGit(repo.dir, args)

  return out.split("\0").filter(Boolean)
}

/**
 * The entries of `folder` (the repo's top by default) at the repo's revision, folders ending
 * in "/"; with `recursive`, every file below it instead.
 */
export async function listFiles(
  repo: ResolvedRepo,
  folder?: string,
  recursive = false,
): Promise<Listing> {
  const paths = recursive ? await everyFile(repo, folder) : await oneLevel(repo, folder)

  return { paths: paths.slice(0, LIST_LIMIT), truncated: paths.length > LIST_LIMIT }
}

/** A file's lines; the newline that ends the last one doesn't start another. */
export function splitLines(text: string): string[] {
  return text.replace(/\n$/, "").split("\n")
}

/** Lines `from` to `to` (inclusive) of a file at the repo's revision; without `to`, a few hundred. */
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
  const all = splitLines(text)
  const lines = all.slice(from - 1, to ?? from - 1 + READ_LIMIT)

  return { path, start: from, lines, total: all.length }
}
