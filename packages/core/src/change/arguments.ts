import { type RangeSpec, parseRange } from "../git/range"
import { type RepoEntry, isRemote, parseRepoEntry } from "../repos/entry"
import { type PullRequest, parsePullRequestUrl } from "../repos/pull-request"

/** A change trail is asked to follow: a range in a repo, or a pull request. */
export type ChangeSource =
  { kind: "range"; repo: RepoEntry; range: RangeSpec } | { kind: "pull-request"; pr: PullRequest }

/**
 * trail's arguments, read: the changes, the repos on the route without changes, and whether
 * uncommitted work is included.
 */
export type ChangeArguments = {
  changes: ChangeSource[]
  unchanged: RepoEntry[]
  uncommitted: boolean
}

const OPTIONS = ["--uncommitted"]

// Options start with "-", which no git ref, path, or URL argument does.
function readOptions(args: string[]): { uncommitted: boolean; words: string[] } {
  const unknown = args.find((arg) => arg.startsWith("-") && !OPTIONS.includes(arg))
  if (unknown !== undefined) {
    throw new Error(`unknown option ${unknown}`)
  }

  return {
    uncommitted: args.includes("--uncommitted"),
    words: args.filter((arg) => !arg.startsWith("-")),
  }
}

type Token =
  | { kind: "pull-request"; pr: PullRequest }
  | { kind: "repo"; entry: RepoEntry }
  | { kind: "range"; text: string }

const CURRENT_REPO: RepoEntry = { source: "." }

// A pull request page whose head git can't fetch: the host publishes no ref for it.
function isUnfetchablePullRequest(text: string): boolean {
  return text.startsWith("http") && text.includes("/pull-requests/")
}

const PATH_STARTS = ["./", "../", "/", "~"]

function looksLikePath(text: string): boolean {
  return text === "." || text === ".." || PATH_STARTS.some((start) => text.startsWith(start))
}

// Git refs can't start with "." or "/", so a path is told from a range by its start; a bare
// word is a repo only when that folder exists.
function readToken(text: string, isDirectory: (path: string) => boolean): Token {
  const pr = parsePullRequestUrl(text)
  if (pr !== undefined) {
    return { kind: "pull-request", pr }
  }

  if (isUnfetchablePullRequest(text)) {
    throw new Error(`can't fetch this pull request: give its repo and a range instead: ${text}`)
  }

  const entry = parseRepoEntry(text)
  if (isRemote(entry.source) || isDirectory(entry.source)) {
    return { kind: "repo", entry }
  }

  if (looksLikePath(entry.source)) {
    throw new Error(`no repo at ${entry.source}`)
  }

  return { kind: "range", text }
}

// A repo with the range that followed it, if any, or a pull request.
type Group =
  { kind: "repo"; repo: RepoEntry; range?: string } | { kind: "pull-request"; pr: PullRequest }

// A range belongs to the repo just before it, or to the current repo when it comes first.
function attachRange(groups: Group[], text: string): void {
  const last = groups.at(-1)
  if (last === undefined) {
    groups.push({ kind: "repo", repo: CURRENT_REPO, range: text })
    return
  }

  if (last.kind !== "repo" || last.range !== undefined) {
    throw new Error(`a range must follow a repo: ${text}`)
  }

  last.range = text
}

// Read in order: which repo a range belongs to depends on what came before it.
function groupTokens(tokens: Token[]): Group[] {
  const groups: Group[] = []
  for (const token of tokens) {
    if (token.kind === "range") {
      attachRange(groups, token.text)
    } else {
      groups.push(token.kind === "repo" ? { kind: "repo", repo: token.entry } : token)
    }
  }

  return groups
}

function rangeFor(repo: RepoEntry, text: string): ChangeSource {
  if (repo.revision !== undefined) {
    throw new Error(`${repo.source}@${repo.revision} is pinned, so it can't take a range: ${text}`)
  }

  return { kind: "range", repo, range: parseRange(text) }
}

function changeOf(group: Group): ChangeSource[] {
  if (group.kind === "pull-request") {
    return [group]
  }

  return group.range === undefined ? [] : [rangeFor(group.repo, group.range)]
}

function unchangedOf(group: Group): RepoEntry[] {
  return group.kind === "repo" && group.range === undefined ? [group.repo] : []
}

/**
 * Reads trail's arguments. A range applies to the repo just before it, or to the current repo
 * when none is; a repo with no range after it is on the route without changes. No change
 * means the current repo's branch since it left the base branch.
 */
export function readChangeArguments(
  args: string[],
  isDirectory: (path: string) => boolean,
): ChangeArguments {
  const { uncommitted, words } = readOptions(args)
  if (words.length === 0) {
    return { changes: [rangeFor(CURRENT_REPO, "")], unchanged: [], uncommitted }
  }

  const groups = groupTokens(words.map((word) => readToken(word, isDirectory)))

  return {
    changes: groups.flatMap(changeOf),
    unchanged: groups.flatMap(unchangedOf),
    uncommitted,
  }
}
