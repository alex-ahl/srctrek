export class GitError extends Error {
  constructor(
    readonly args: string[],
    readonly stderr: string,
  ) {
    super(`git ${args.join(" ")} failed: ${stderr.trim()}`)
    this.name = "GitError"
  }
}

/**
 * Runs git in `cwd` and returns its stdout, trimmed unless `trim` is false (file contents keep
 * their exact text); throws GitError on a non-zero exit.
 */
export async function runGit(
  cwd: string,
  args: string[],
  { trim = true }: { trim?: boolean } = {},
): Promise<string> {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
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
