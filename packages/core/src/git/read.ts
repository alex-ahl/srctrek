import { GitError, runGit } from "./run"

// git reports a path missing at a commit as an ordinary failure; that answer is "not there".
async function unlessMissing(read: Promise<string>): Promise<string | undefined> {
  try {
    return await read
  } catch (error) {
    if (error instanceof GitError) return undefined
    throw error
  }
}

/** The file's content at `commit`, from git objects; undefined when it doesn't exist there. */
export async function readFileAt(
  cwd: string,
  commit: string,
  path: string,
): Promise<string | undefined> {
  return unlessMissing(runGit(cwd, ["show", `${commit}:${path}`], { trim: false }))
}

/** The file's git blob id at `commit`; undefined when it doesn't exist there. */
export async function blobAt(
  cwd: string,
  commit: string,
  path: string,
): Promise<string | undefined> {
  return unlessMissing(runGit(cwd, ["rev-parse", "--verify", "--quiet", `${commit}:${path}`]))
}
