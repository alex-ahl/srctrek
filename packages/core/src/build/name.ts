import { type RepoWithRange, type ResolvedChange, hasRange } from "../change/resolve"
import { GitError, runGit } from "../git/run"

// Tour names are lowercase letters, digits, and dashes; long branch names are cut.
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function currentBranch(dir: string): Promise<string | undefined> {
  try {
    return await runGit(dir, ["symbolic-ref", "--short", "--quiet", "HEAD"])
  } catch (error) {
    if (error instanceof GitError) {
      return undefined
    }

    throw error
  }
}

async function isSnapshot(dir: string, commit: string): Promise<boolean> {
  try {
    await runGit(dir, ["rev-parse", "--verify", "--quiet", `refs/codetrail/snapshots/${commit}`])
    return true
  } catch (error) {
    if (error instanceof GitError) {
      return false
    }

    throw error
  }
}

// What the range's head is called: a pull request's number, the branch checked out (marked
// when the head is a snapshot of uncommitted work), or the branch or ref the range names.
async function headName(repo: RepoWithRange): Promise<string> {
  const { head, headCommit } = repo.range
  const request = /^refs\/(pull|merge-requests)\/(\d+)\//.exec(head)
  if (request !== null) {
    return `${request[1] === "pull" ? "pr" : "mr"}-${request[2]}`
  }

  const checkedOut = (await currentBranch(repo.dir)) ?? headCommit.slice(0, 7)
  if (head === "HEAD") {
    return checkedOut
  }

  if (await isSnapshot(repo.dir, headCommit)) {
    return `${checkedOut}-uncommitted`
  }

  return head
}

/** A name for a new tour of the change, from its heads: "feature-refunds", "pr-12". */
export async function tourNameFor(change: ResolvedChange): Promise<string> {
  const names = await Promise.all(change.repos.filter(hasRange).map(headName))

  return slug([...new Set(names)].join("-")) || "tour"
}
