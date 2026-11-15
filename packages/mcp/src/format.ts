// What each tool answers, as plain text for the agent to read.
import { CUT_NOTES, linesPartNote, patchCutNote } from "@srctrek/core"
import type {
  ChangedFiles,
  FileChange,
  Listing,
  Nearby,
  NearbyRepo,
  NumberedLines,
  Patch,
  ResolvedChange,
  SearchResult,
} from "@srctrek/core"

function describeRange(repo: ResolvedChange["repos"][number]): string {
  if (repo.range === undefined) {
    return "unchanged"
  }

  const { baseCommit, headCommit, mode } = repo.range
  return `${baseCommit.slice(0, 7)}..${headCommit.slice(0, 7)} (${mode})`
}

/** "api  9c1e2f3  1a2b3c4..9c1e2f3 (since-branch-point)", one repo per line. */
function describeNearby({ path, branch }: NearbyRepo): string {
  return branch === undefined ? path : `${path} (has branch ${branch})`
}

// "not opened, next to this repo: ../api (has branch feature), ../docs, and 12 more"
function nearbyLine({ repos, leftOut }: Nearby): string[] {
  if (repos.length === 0) {
    return []
  }

  const more = leftOut > 0 ? `, and ${leftOut} more` : ""
  return [`not opened, next to this repo: ${repos.map(describeNearby).join(", ")}${more}`]
}

export function formatChange(change: ResolvedChange, nearby: Nearby): string {
  const repos = change.repos.map(
    (repo) => `${repo.name}  ${repo.revision.slice(0, 7)}  ${describeRange(repo)}`,
  )
  return [...repos, ...nearbyLine(nearby)].join("\n")
}

/** One path per line, folders ending in "/", and a note when the listing was cut. */
export function formatListing({ paths, truncated }: Listing): string {
  const cut = truncated ? [CUT_NOTES.listing] : []

  return [...paths, ...cut].join("\n")
}

/**
 * The path, then "  12 | text" lines, numbers padded so the code lines up, and a note saying
 * which part of the file this is when it isn't all of it.
 */
export function formatLines({ path, start, lines, total }: NumberedLines): string {
  const lastLine = start + lines.length - 1
  const width = String(lastLine).length
  const numbered = lines.map(
    (text, offset) => `${String(start + offset).padStart(width)} | ${text}`,
  )
  const isPart = start > 1 || lastLine < total
  const part = isPart ? [linesPartNote(start, lastLine, total)] : []

  return [path, ...numbered, ...part].join("\n")
}

/** "path:line: text" per match. */
export function formatMatches({ matches, truncated }: SearchResult): string {
  if (matches.length === 0) {
    return "no matches"
  }

  const lines = matches.map((match) => `${match.path}:${match.line}: ${match.text}`)
  const cut = truncated ? [CUT_NOTES.matches] : []

  return [...lines, ...cut].join("\n")
}

/** "modified src/app.ts", "renamed src/old.ts -> src/new.ts", one file per line. */
export function formatFileChanges({ files, truncated }: ChangedFiles): string {
  const describe = (file: FileChange) =>
    file.oldPath === undefined
      ? `${file.status} ${file.path}`
      : `${file.status} ${file.oldPath} -> ${file.path}`
  const cut = truncated ? [CUT_NOTES.changedFiles] : []

  return [...files.map(describe), ...cut].join("\n")
}

/** A file's patch, and a note when its end was cut. */
export function formatPatch({ patch, cutLines }: Patch): string {
  const cut = cutLines > 0 ? [patchCutNote(cutLines)] : []

  return [patch, ...cut].join("\n")
}
