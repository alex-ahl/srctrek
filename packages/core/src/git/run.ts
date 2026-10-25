export class GitError extends Error {
  constructor(
    readonly args: string[],
    readonly stderr: string,
  ) {
    super(`git ${args.join(" ")} failed: ${stderr.trim()}`)
    this.name = "GitError"
  }
}

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
    throw new GitError(args, stderr)
  }

  return trim ? stdout.trim() : stdout
}
