import { type RepoWithRange, type ResolvedChange, hasRange } from "../change/resolve"
import { detectBase, isBaseBranch } from "../git/base"
import { checkedOutBranch, hasBranch, hasRef, isSnapshot } from "../git/refs"
import { NO_PROMPT, runGit } from "../git/run"
import { isRemote } from "./entry"
import { pullRequestOfRef } from "./pull-request"

// Whether a range's head stands for what's checked out: HEAD itself, a snapshot of its
// uncommitted work, or HEAD's commit, which is what a snapshot with nothing uncommitted is.
async function standsForHead(dir: string, head: string): Promise<boolean> {
  if (head === "HEAD" || (await isSnapshot(dir, head))) {
    return true
  }

  return head === (await runGit(dir, ["rev-parse", "HEAD"]))
}

// "origin/feature" without its remote: "feature".
function withoutRemote(tracking: string): string {
  return tracking.split("/").slice(1).join("/")
}

// A branch the work is on, written as a local branch, or as a remote-tracking one:
// "origin/feature" is the work on "feature", as a reviewer who hasn't checked it out has it.
async function localBranchName(dir: string, head: string): Promise<string | undefined> {
  if (await standsForHead(dir, head)) {
    return checkedOutBranch(dir)
  }

  if (await hasBranch(dir, head)) {
    return head
  }

  const isTracking = head.includes("/") && (await hasRef(dir, `refs/remotes/${head}`))
  return isTracking ? withoutRemote(head) : undefined
}

// The branch a pull request was opened from: the host's branch whose head is its head
// commit. None when it came from a fork, or the branch has moved on since.
async function pullRequestBranch(dir: string, headCommit: string): Promise<string | undefined> {
  const listed = await runGit(dir, ["ls-remote", "--heads", "origin"], { env: NO_PROMPT })
  const atHead = listed.split("\n").find((line) => line.startsWith(`${headCommit}\t`))

  return atHead?.split("\trefs/heads/")[1]
}

// A remote range names its head as the user wrote it: a branch, unless it's a commit.
function remoteBranchName(head: string): string | undefined {
  return /^[0-9a-f]{7,40}$/.test(head) ? undefined : head
}

function branchNameOf(repo: RepoWithRange): Promise<string | undefined> {
  const { head, headCommit } = repo.range
  if (pullRequestOfRef(head) !== undefined) {
    return pullRequestBranch(repo.dir, headCommit).catch(() => undefined)
  }

  if (isRemote(repo.source)) {
    return Promise.resolve(remoteBranchName(head))
  }

  return localBranchName(repo.dir, head)
}

// A branch names the work only when it isn't the repo's base: every repo has a main.
async function workBranchOf(dir: string, branch: string | undefined): Promise<string[]> {
  if (branch === undefined) {
    return []
  }

  const base = await detectBase(dir).catch(() => undefined)
  return base !== undefined && isBaseBranch(base, branch) ? [] : [branch]
}

/**
 * The branches the work is on: where each changed repo's range ends (a local branch, a
 * remote-tracking one, a remote range's head, or the branch a pull request was opened from),
 * or, for a trek of code as it is, the branch checked out in the current repo. Another repo
 * with a branch of the same name holds that work's other side, by the usual convention for
 * work across repos.
 */
export async function workBranches(cwd: string, change: ResolvedChange): Promise<string[]> {
  const heads = await Promise.all(
    change.repos
      .filter(hasRange)
      .map(async (repo) => workBranchOf(repo.dir, await branchNameOf(repo))),
  )
  const current =
    change.code === undefined ? [] : await workBranchOf(cwd, await checkedOutBranch(cwd))

  return [...new Set([...heads.flat(), ...current])]
}
