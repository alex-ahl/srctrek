import { GitError, runGit } from "./run"

// Whether git accepts `args` in `dir`: the answer to a git question asked through its exit code.
async function succeeds(dir: string, args: string[]): Promise<boolean> {
  try {
    await runGit(dir, args)
    return true
  } catch (error) {
    if (error instanceof GitError) {
      return false
    }

    throw error
  }
}

/** The branch HEAD is on; none when it's detached. */
export async function checkedOutBranch(dir: string): Promise<string | undefined> {
  try {
    return await runGit(dir, ["symbolic-ref", "--short", "--quiet", "HEAD"])
  } catch (error) {
    if (error instanceof GitError) {
      return undefined
    }

    throw error
  }
}

/** Whether `commit` is a snapshot srctrek made of uncommitted work. */
export function isSnapshot(dir: string, commit: string): Promise<boolean> {
  return succeeds(dir, ["rev-parse", "--verify", "--quiet", `refs/srctrek/snapshots/${commit}`])
}

/** Whether the repo has `revision` as a commit. */
export function hasCommit(dir: string, revision: string): Promise<boolean> {
  return succeeds(dir, ["cat-file", "-e", `${revision}^{commit}`])
}

/** Whether the repo has `ref`, written in full: "refs/remotes/origin/feature". */
export function hasRef(dir: string, ref: string): Promise<boolean> {
  return succeeds(dir, ["show-ref", "--verify", "--quiet", ref])
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
