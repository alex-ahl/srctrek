import { type RepoWithRange, type ResolvedChange, hasRange } from "../change/resolve"
import { checkedOutBranch, isSnapshot } from "../git/refs"

// Tour names are lowercase letters, digits, and dashes; long branch names are cut.
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

// What the range's head is called: a pull request's number, the branch checked out (marked
// when the head is a snapshot of uncommitted work), or the branch or ref the range names.
async function headName(repo: RepoWithRange): Promise<string> {
  const { head, headCommit } = repo.range
  const request = /^refs\/(pull|merge-requests)\/(\d+)\//.exec(head)
  if (request !== null) {
    return `${request[1] === "pull" ? "pr" : "mr"}-${request[2]}`
  }

  const checkedOut = (await checkedOutBranch(repo.dir)) ?? headCommit.slice(0, 7)
  if (head === "HEAD") {
    return checkedOut
  }

  if (await isSnapshot(repo.dir, headCommit)) {
    return `${checkedOut}-uncommitted`
  }

  return head
}

// A tour of code as it is is named after its trigger, or after its first repo when the agent
// picks the trigger: "a-refund-request", "api-code".
function codeTourName(change: ResolvedChange): string {
  const trigger = change.code?.trigger
  const named = trigger === undefined ? `${change.repos[0]?.name ?? "repo"}-code` : trigger

  return slug(named) || "tour"
}

/** A name for a new tour, from the change's heads ("feature-refunds", "pr-12") or code tour. */
export async function tourNameFor(change: ResolvedChange): Promise<string> {
  if (change.code !== undefined) {
    return codeTourName(change)
  }

  const names = await Promise.all(change.repos.filter(hasRange).map(headName))

  return slug([...new Set(names)].join("-")) || "tour"
}
