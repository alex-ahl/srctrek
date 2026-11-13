import { runGit, unlessGitFails } from "./run"

/** The file's content at `commit`, from git objects; undefined when it doesn't exist there. */
export async function readFileAt(
  cwd: string,
  commit: string,
  path: string,
): Promise<string | undefined> {
  return unlessGitFails(runGit(cwd, ["show", `${commit}:${path}`], { trim: false }))
}

/** The file's git blob id at `commit`; undefined when it doesn't exist there. */
export async function blobAt(
  cwd: string,
  commit: string,
  path: string,
): Promise<string | undefined> {
  return unlessGitFails(runGit(cwd, ["rev-parse", "--verify", "--quiet", `${commit}:${path}`]))
}
