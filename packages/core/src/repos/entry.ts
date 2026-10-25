/** A repo as written in .codetrail/repos or on the command line, maybe pinned to a revision. */
export type RepoEntry = { source: string; revision?: string }

/**
 * "../gateway", "../payments@v2.3". The last "@" starts a revision only when no "/" or ":"
 * follows it, so the user part of an SSH URL (git@host:org/repo) isn't read as one.
 */
export function parseRepoEntry(text: string): RepoEntry {
  const at = text.lastIndexOf("@")
  const rest = text.slice(at + 1)
  const isRevision = at > 0 && rest !== "" && !/[/:]/.test(rest)
  return isRevision ? { source: text.slice(0, at), revision: rest } : { source: text }
}

/** "git@host:org/repo", "https://…", "ssh://…": anything that isn't a local path. */
export function isRemote(source: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(source) || /^[^/\s]+@[^/\s]+:/.test(source)
}
