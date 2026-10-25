import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { type RepoEntry, parseRepoEntry } from "./entry"

export const REPOS_LIST = join(".codetrail", "repos")

/** Entries of a repos list: one per line; blank lines and "#" comments are skipped. */
export function parseReposList(text: string): RepoEntry[] {
  return text
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line !== "")
    .map(parseRepoEntry)
}

/** The repos listed in `root`'s .codetrail/repos; none when the file doesn't exist. */
export async function readReposList(root: string): Promise<RepoEntry[]> {
  const text = await readFile(join(root, REPOS_LIST), "utf8").catch(() => "")
  return parseReposList(text)
}
