import { gitSucceeds, runGit, unlessGitFails } from "./run"

/** The branch HEAD is on; none when it's detached. */
export function checkedOutBranch(dir: string): Promise<string | undefined> {
  return unlessGitFails(runGit(dir, ["symbolic-ref", "--short", "--quiet", "HEAD"]))
}

/** Whether `commit` is a snapshot srctrek made of uncommitted work. */
export function isSnapshot(dir: string, commit: string): Promise<boolean> {
  return gitSucceeds(dir, ["rev-parse", "--verify", "--quiet", `refs/srctrek/snapshots/${commit}`])
}

/** Whether the repo has `revision` as a commit. */
export function hasCommit(dir: string, revision: string): Promise<boolean> {
  return gitSucceeds(dir, ["cat-file", "-e", `${revision}^{commit}`])
}

/** Whether `commit` is in `ref`'s history: merged into it, or where it is. */
export function isAncestor(dir: string, commit: string, ref: string): Promise<boolean> {
  return gitSucceeds(dir, ["merge-base", "--is-ancestor", commit, ref])
}

/** Whether the repo has `ref`, written in full: "refs/remotes/origin/feature". */
export function hasRef(dir: string, ref: string): Promise<boolean> {
  return gitSucceeds(dir, ["show-ref", "--verify", "--quiet", ref])
}

/** Whether the repo has a local branch named `name`. */
export function hasBranch(dir: string, name: string): Promise<boolean> {
  return hasRef(dir, `refs/heads/${name}`)
}

/**
 * The ref to read a branch named `name` from: the local branch when there is one, else a
 * remote-tracking branch of that name, origin's first, as of the last fetch; none when the
 * repo has neither. `shown` is what to call it: "feature", or "origin/feature".
 */
export async function branchToRead(
  dir: string,
  name: string,
): Promise<{ ref: string; shown: string } | undefined> {
  if (await hasBranch(dir, name)) {
    return { ref: `refs/heads/${name}`, shown: name }
  }

  const listed = await runGit(dir, [
    "for-each-ref",
    "--format=%(refname)",
    `refs/remotes/*/${name}`,
  ])
  const tracking = listed.split("\n").filter((ref) => ref !== "")
  const ref =
    tracking.find((candidate) => candidate.startsWith("refs/remotes/origin/")) ?? tracking[0]

  return ref === undefined ? undefined : { ref, shown: ref.replace(/^refs\/remotes\//, "") }
}

/** How many commits `to` has that `from` doesn't: "4" for a branch 4 commits past its base. */
/** The branch `branch` tracks, "origin/development"; none when it tracks nothing. */
export function upstreamOf(dir: string, branch: string): Promise<string | undefined> {
  return unlessGitFails(runGit(dir, ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`]))
}

export async function commitsBetween(dir: string, from: string, to: string): Promise<number> {
  return Number(await runGit(dir, ["rev-list", "--count", `${from}..${to}`]))
}

/** How many files differ between commits `from` and `to`. */
export async function filesBetween(dir: string, from: string, to: string): Promise<number> {
  const names = await runGit(dir, ["diff", "--name-only", from, to])
  return names === "" ? 0 : names.split("\n").length
}
