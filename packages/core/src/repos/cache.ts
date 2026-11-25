import { mkdir, rename, rm } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { pathExists } from "../files"
import { NO_PROMPT, runGit } from "../git/run"

/** Where remote repos are kept: $XDG_CACHE_HOME/srctrek, else ~/.cache/srctrek. */
export function defaultCacheDir(): string {
  const cacheHome = process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache")
  return join(cacheHome, "srctrek")
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

// Cloned beside its final place and renamed when complete, so an interrupted clone is never
// mistaken for a finished one.
async function cloneInto(dir: string, cloneUrl: string): Promise<void> {
  const partial = `${dir}.partial-${process.pid}`
  await mkdir(dirname(dir), { recursive: true })
  await rm(partial, { recursive: true, force: true })

  const args = ["clone", "--quiet", "--bare", "--filter=blob:none", cloneUrl, partial]
  await runGit(dirname(dir), args, NO_PROMPT)

  await rename(partial, dir)
}

/**
 * The cached clone of `cloneUrl`, cloned on first use: a partial bare clone, so file contents
 * download only when read. Returns its folder.
 */
export async function cachedRepo(cacheDir: string, cloneUrl: string): Promise<string> {
  const dir = cachePath(cacheDir, cloneUrl)
  if (!(await pathExists(dir))) {
    await cloneInto(dir, cloneUrl)
  }

  return dir
}

// The branch the host's HEAD named when the clone was made: its default branch.
async function defaultBranch(dir: string): Promise<string> {
  return runGit(dir, ["symbolic-ref", "--short", "HEAD"])
}

/**
 * Brings a cached clone's default branch up to date, plus extra refs such as a pull request's
 * head; nothing else, since a host may have thousands of branches a trek never reads.
 */
export async function fetchRefs(dir: string, refs: string[] = []): Promise<void> {
  const wanted = [`refs/heads/${await defaultBranch(dir)}`, ...refs]
  const refspecs = wanted.map((ref) => `+${ref}:${ref}`)
  await runGit(dir, ["fetch", "--quiet", "origin", ...refspecs], NO_PROMPT)
}

/** Fetches one revision by name (a branch, a tag, a commit the host serves); its commit. */
export async function fetchRevision(dir: string, revision: string): Promise<string> {
  await runGit(dir, ["fetch", "--quiet", "origin", revision], NO_PROMPT)

  return runGit(dir, ["rev-parse", "--verify", "FETCH_HEAD^{commit}"])
}
