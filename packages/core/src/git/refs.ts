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

/** Whether `commit` is a snapshot codetrail made of uncommitted work. */
export function isSnapshot(dir: string, commit: string): Promise<boolean> {
  return succeeds(dir, ["rev-parse", "--verify", "--quiet", `refs/codetrail/snapshots/${commit}`])
}

/** Whether the repo has a local branch named `name`. */
export function hasBranch(dir: string, name: string): Promise<boolean> {
  return succeeds(dir, ["show-ref", "--verify", "--quiet", `refs/heads/${name}`])
}
