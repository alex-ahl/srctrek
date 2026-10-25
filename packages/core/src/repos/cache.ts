import { mkdir, rename, rm, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { runGit } from "../git/run"

// Fail instead of asking for a password: a prompt would hang behind the TUI. Logins come from
// the user's own git setup (credential helper, SSH agent). SSH is left alone: forcing its
// batch mode would override the user's core.sshCommand.
const NO_PROMPT = { GIT_TERMINAL_PROMPT: "0" }

/** Where remote repos are kept: $XDG_CACHE_HOME/codetrail, else ~/.cache/codetrail. */
export function defaultCacheDir(): string {
  const cacheHome = process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache")
  return join(cacheHome, "codetrail")
}

// "https://github.com/acme/pay" -> "github.com/acme/pay"; "git@github.com:acme/pay.git" ->
// "github.com/acme/pay.git".
function hostAndPath(cloneUrl: string): string {
  const withoutScheme = cloneUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
  const withoutUser = withoutScheme.replace(/^[^/@]+@/, "")
  // SSH's "host:org/repo" -> "host/org/repo"; a port ("host:2222/...") stays
  const sshPathAsFolder = withoutUser.replace(/^([^/:]+):(?!\d)/, "$1/")

  return sshPathAsFolder.replace(/^\/+|\/+$/g, "")
}

/**
 * The cache folder for a clone URL, by host and path, so the HTTPS and SSH URLs of one repo
 * share a clone.
 */
export function cachePath(cacheDir: string, cloneUrl: string): string {
  const path = hostAndPath(cloneUrl)
  const bare = path.endsWith(".git") ? path : `${path}.git`

  return join(cacheDir, "repos", bare)
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

// Cloned beside its final place and renamed when complete, so an interrupted clone is never
// mistaken for a finished one.
async function cloneInto(dir: string, cloneUrl: string): Promise<void> {
  const partial = `${dir}.partial-${process.pid}`
  await mkdir(dirname(dir), { recursive: true })
  await rm(partial, { recursive: true, force: true })

  const args = ["clone", "--quiet", "--bare", "--filter=blob:none", cloneUrl, partial]
  await runGit(dirname(dir), args, { env: NO_PROMPT })

  await rename(partial, dir)
}

/**
 * The cached clone of `cloneUrl`, cloned on first use: a partial bare clone, so file contents
 * download only when read. Returns its folder.
 */
export async function cachedRepo(cacheDir: string, cloneUrl: string): Promise<string> {
  const dir = cachePath(cacheDir, cloneUrl)
  if (!(await exists(dir))) {
    await cloneInto(dir, cloneUrl)
  }

  return dir
}

/** Brings a cached clone's branches up to date, plus extra refs such as a pull request's head. */
export async function fetchRefs(dir: string, refs: string[] = []): Promise<void> {
  const refspecs = ["+refs/heads/*:refs/heads/*", ...refs.map((ref) => `+${ref}:${ref}`)]
  await runGit(dir, ["fetch", "--quiet", "--prune", "origin", ...refspecs], { env: NO_PROMPT })
}
