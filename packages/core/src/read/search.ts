import type { ResolvedRepo } from "../change/resolve"
import { GitError, runGit } from "../git/run"
import { pathsUnder } from "./repo"

export type Match = { path: string; line: number; text: string }

/** Matches in file order; `truncated` when there were more than were returned. */
export type SearchResult = { matches: Match[]; truncated: boolean }

// Enough to orient by; a pattern that matches more should be narrowed, not paged through.
const MATCH_LIMIT = 200

// git grep exits 1 when nothing matches, which is an answer, not a failure.
async function grepOrNothing(dir: string, args: string[]): Promise<string> {
  try {
    return await runGit(dir, args)
  } catch (error) {
    if (error instanceof GitError && error.code === 1) {
      return ""
    }

    throw error
  }
}

// With -z, each match is "<revision>:<path>\0<line>\0<text>".
function readMatch(revision: string, record: string): Match {
  const [location = "", line = "", text = ""] = record.split("\0")
  const path = location.slice(`${revision}:`.length)

  return { path, line: Number(line), text }
}

/** Lines matching an extended regular expression at the repo's revision, under `folder`. */
export async function search(
  repo: ResolvedRepo,
  pattern: string,
  folder?: string,
): Promise<SearchResult> {
  const args = ["grep", "-z", "-n", "-I", "-E", "-e", pattern, repo.revision, ...pathsUnder(folder)]
  const records = (await grepOrNothing(repo.dir, args)).split("\n").filter(Boolean)

  return {
    matches: records.slice(0, MATCH_LIMIT).map((record) => readMatch(repo.revision, record)),
    truncated: records.length > MATCH_LIMIT,
  }
}
