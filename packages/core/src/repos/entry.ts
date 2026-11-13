import { basename } from "node:path"

/**
 * A repo as written in .srctrek/repos or on the command line: where it is, maybe pinned to a
 * revision, maybe named after the service the code calls.
 */
export type RepoEntry = { name?: string; source: string; revision?: string }

/**
 * "../payments@v2.3". The last "@" starts a revision only when no "/" or ":" follows it, so
 * the user part of an SSH URL (git@host:org/repo) isn't read as one.
 */
function parseLocation(text: string): RepoEntry {
  const at = text.lastIndexOf("@")
  const rest = text.slice(at + 1)
  const isRevision = at > 0 && rest !== "" && !/[/:]/.test(rest)
  return isRevision ? { source: text.slice(0, at), revision: rest } : { source: text }
}

/** "../gateway", "../payments@v2.3", or named: "payments = ../payments@v2.3". */
export function parseRepoEntry(text: string): RepoEntry {
  const named = /^([\w.-]+)\s*=\s*(.+)$/.exec(text)
  if (!named) {
    return parseLocation(text)
  }

  const [, name = "", location = ""] = named
  return { name, ...parseLocation(location) }
}

/** A repo's folder name: "../payments/" and "org/payments.git" are "payments". */
export function folderName(path: string): string {
  return basename(path.replace(/\/+$/, "")).replace(/\.git$/, "")
}

/** "git@host:org/repo", "https://…", "ssh://…": anything that isn't a local path. */
export function isRemote(source: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(source) || /^[^/\s]+@[^/\s]+:/.test(source)
}
