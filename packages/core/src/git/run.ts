export class GitError extends Error {
  constructor(
    readonly args: string[],
    readonly stderr: string,
    readonly code: number,
  ) {
    super(`git ${args.join(" ")} failed: ${stderr.trim()}`)
    this.name = "GitError"
  }
}

type RunOptions = {
  trim?: boolean // false keeps file contents' exact text
  env?: Record<string, string> // added to the inherited environment
  detached?: boolean // in a session of its own, without the terminal trek runs in
}

// Fail instead of asking for a password: a prompt would hang behind the TUI, or draw over it.
// Logins come from the user's own git setup (credential helper, SSH agent). ssh and its helpers
// ask on the terminal itself, past GIT_TERMINAL_PROMPT, so git runs without one. Forcing ssh's
// batch mode instead would override the user's core.sshCommand.
export const NO_PROMPT: RunOptions = { env: { GIT_TERMINAL_PROMPT: "0" }, detached: true }

/** Runs git in `cwd` and returns its stdout, trimmed by default; throws GitError on failure. */
export async function runGit(
  cwd: string,
  args: string[],
  { trim = true, env = {}, detached = false }: RunOptions = {},
): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    env: { ...process.env, ...env },
    detached,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) {
    throw new GitError(args, stderr, code)
  }

  return trim ? stdout.trim() : stdout
}

/**
 * What `work` answers, or none when git fails: git reports "no such ref", "no upstream", or "not
 * a repo" as an ordinary failure, and that answer is "none". Anything else still throws.
 */
export async function unlessGitFails<T>(work: Promise<T>): Promise<T | undefined> {
  try {
    return await work
  } catch (error) {
    if (error instanceof GitError) {
      return undefined
    }

    throw error
  }
}

/** Whether git accepts `args` in `dir`: a git question answered through its exit code. */
export async function gitSucceeds(dir: string, args: string[]): Promise<boolean> {
  return (await unlessGitFails(runGit(dir, args))) !== undefined
}
