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

// Fail instead of asking for a password: a prompt would hang behind the TUI. Logins come from
// the user's own git setup (credential helper, SSH agent). SSH is left alone: forcing its
// batch mode would override the user's core.sshCommand.
export const NO_PROMPT = { GIT_TERMINAL_PROMPT: "0" }

type RunOptions = {
  trim?: boolean // false keeps file contents' exact text
  env?: Record<string, string> // added to the inherited environment
}

/** Runs git in `cwd` and returns its stdout, trimmed by default; throws GitError on failure. */
export async function runGit(
  cwd: string,
  args: string[],
  { trim = true, env = {} }: RunOptions = {},
): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    env: { ...process.env, ...env },
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
