import { checkedOutBranch, isSnapshot } from "../git/refs"
import { pullRequestOfRef } from "../repos/pull-request"
import type { z } from "zod"
import type { RangeHeadSchema } from "../schema/trek"
import type { RepoWithRange } from "./resolve"

/** What a changed repo's range ends at; see RangeHeadSchema. */
export type RangeHead = z.infer<typeof RangeHeadSchema>

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
