import { type ResolvedChange, hasRange } from "../change/resolve"
import { detectBase } from "../git/base"
import { checkedOutBranch, hasBranch, isSnapshot } from "../git/refs"
import { runGit } from "../git/run"
import { isRemote } from "./entry"

// Whether a range's head stands for what's checked out: HEAD itself, a snapshot of its
// uncommitted work, or HEAD's commit, which is what a snapshot with nothing uncommitted is.
async function standsForHead(dir: string, head: string): Promise<boolean> {
  if (head === "HEAD" || (await isSnapshot(dir, head))) {
    return true
  }

  return head === (await runGit(dir, ["rev-parse", "HEAD"]))
}

// A branch names the work only when it isn't the repo's base: every repo has a main.
async function workBranchOf(dir: string, branch: string | undefined): Promise<string[]> {
  if (branch === undefined || !(await hasBranch(dir, branch))) {
    return []
  }

  return branch === (await detectBase(dir).catch(() => undefined)) ? [] : [branch]
}

// The branch a changed local repo's range ends at: the one checked out when the head stands
// for HEAD, else the head as written when it's a branch. A pull request, a tag, or a remote
// range names none here.
async function headBranch(source: string, dir: string, head: string): Promise<string[]> {
  if (isRemote(source)) {
    return []
  }

  const branch = (await standsForHead(dir, head)) ? await checkedOutBranch(dir) : head
  return workBranchOf(dir, branch)
}

/**
 * The branches the work is on: where each changed local repo's range ends, or, for a tour of
 * code as it is, the branch checked out in the current repo. Another repo with a branch of
 * the same name holds that work's other side, by the usual convention for work across repos.
 */
export async function workBranches(cwd: string, change: ResolvedChange): Promise<string[]> {
  const heads = await Promise.all(
    change.repos.filter(hasRange).map((repo) => headBranch(repo.source, repo.dir, repo.range.head)),
  )
  const current =
    change.code === undefined ? [] : await workBranchOf(cwd, await checkedOutBranch(cwd))

  return [...new Set([...heads.flat(), ...current])]
}
