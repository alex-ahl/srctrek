import { GitError, runGit } from "./run"

async function refExists(cwd: string, ref: string): Promise<boolean> {
  try {
    await runGit(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])
    return true
  } catch (error) {
    if (error instanceof GitError) {
      return false
    }

    throw error
  }
}

// What origin/HEAD points to, e.g. "origin/main"; absent when the remote's default isn't known.
async function remoteDefault(cwd: string): Promise<string | undefined> {
  try {
    const ref = await runGit(cwd, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"])
    return ref.replace(/^refs\/remotes\//, "")
  } catch (error) {
    if (error instanceof GitError) {
      return undefined
    }

    throw error
  }
}

async function isBare(cwd: string): Promise<boolean> {
  return (await runGit(cwd, ["rev-parse", "--is-bare-repository"])) === "true"
}

/**
 * The branch changes are compared against: the remote's default branch, else a local main or
 * master. Throws when none exists.
 */
export async function detectBase(cwd: string): Promise<string> {
  const remote = await remoteDefault(cwd)
  if (remote !== undefined) {
    return remote
  }

  // A cached clone is bare, without origin/HEAD; its own HEAD is the host's default branch.
  if (await isBare(cwd)) {
    return runGit(cwd, ["symbolic-ref", "--short", "HEAD"])
  }

  for (const candidate of ["main", "master"]) {
    if (await refExists(cwd, candidate)) {
      return candidate
    }
  }

  throw new Error("no base branch: origin/HEAD is unset and there is no main or master")
}
