import { type RepoWithRange, type ResolvedChange, hasRange } from "../change/resolve"
import { rangeHead } from "../change/head"

// Trek names are lowercase letters, digits, and dashes; long branch names are cut.
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

// What the range's head is called: "pr-12", "mr-4", the branch, or the branch with
// "-uncommitted" for a snapshot of the work on it.
async function headName(repo: RepoWithRange): Promise<string> {
  const head = await rangeHead(repo)
  if (head.kind !== "branch") {
    return `${head.kind === "pull" ? "pr" : "mr"}-${head.number}`
  }

  return head.uncommitted ? `${head.name}-uncommitted` : head.name
}

// A trek of code as it is is named after its trigger, or after its first repo when the agent
// picks the trigger: "a-refund-request", "api-code".
function codeTrekName(change: ResolvedChange): string {
  const trigger = change.code?.trigger
  const named = trigger === undefined ? `${change.repos[0]?.name ?? "repo"}-code` : trigger

  return slug(named) || "trek"
}

/** A name for a new trek, from the change's heads ("feature-refunds", "pr-12") or code trek. */
export async function trekNameFor(change: ResolvedChange): Promise<string> {
  if (change.code !== undefined) {
    return codeTrekName(change)
  }

  const names = await Promise.all(change.repos.filter(hasRange).map(headName))

  return slug([...new Set(names)].join("-")) || "trek"
}
