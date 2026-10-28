import { join, resolve } from "node:path"
import { runGit } from "../git/run"

/** Where a build's files live: its log (the agent's output, and trail mcp's lines) and exit code. */
export type BuildFiles = Readonly<{ dir: string; log: string; exit: string }>

/**
 * A build's files, inside the repo's git folder (the shared one, for a worktree), so they're
 * never committed with the tours. Nothing is created: only starting a build writes there.
 */
export async function buildFiles(root: string, name: string): Promise<BuildFiles> {
  const gitDir = resolve(root, await runGit(root, ["rev-parse", "--git-common-dir"]))
  const dir = join(gitDir, "codetrail", "builds")

  return {
    dir,
    log: join(dir, `${name}.log`),
    exit: join(dir, `${name}.exit`),
  }
}
