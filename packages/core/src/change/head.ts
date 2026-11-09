import { checkedOutBranch, isSnapshot } from "../git/refs"
import { pullRequestOfRef } from "../repos/pull-request"
import type { RepoWithRange } from "./resolve"

/**
 * What a changed repo's range ends at: a pull request or merge request by number; or a branch,
 * the one the range names or, for HEAD, the one checked out (its short commit when detached),
 * marked when the head is a snapshot of the uncommitted work on it.
 */
export type RangeHead = Readonly<
  | { kind: "pull" | "merge-requests"; number: number }
  | { kind: "branch"; name: string; uncommitted: boolean }
>

export async function rangeHead(repo: RepoWithRange): Promise<RangeHead> {
  const { head, headCommit } = repo.range
  const request = pullRequestOfRef(head)
  if (request !== undefined) {
    return request
  }

  const checkedOut = (await checkedOutBranch(repo.dir)) ?? headCommit.slice(0, 7)
  if (head === "HEAD") {
    return { kind: "branch", name: checkedOut, uncommitted: false }
  }

  if (await isSnapshot(repo.dir, headCommit)) {
    return { kind: "branch", name: checkedOut, uncommitted: true }
  }

  return { kind: "branch", name: head, uncommitted: false }
}
