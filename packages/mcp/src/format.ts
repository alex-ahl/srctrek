// What each tool answers, as plain text for the agent to read.
import type { FileChange, NumberedLines, ResolvedChange, SearchResult } from "@codetrail/core"

function describeRange(repo: ResolvedChange["repos"][number]): string {
  if (repo.range === undefined) {
    return "unchanged"
  }

  const { baseCommit, headCommit, mode } = repo.range
  return `${baseCommit.slice(0, 7)}..${headCommit.slice(0, 7)} (${mode})`
}

/** "api  9c1e2f3  1a2b3c4..9c1e2f3 (since-branch-point)", one repo per line. */
export function formatChange(change: ResolvedChange): string {
  return change.repos
    .map((repo) => `${repo.name}  ${repo.revision.slice(0, 7)}  ${describeRange(repo)}`)
    .join("\n")
}

/** The path, then "  12 | text" lines, numbers padded so the code lines up. */
export function formatLines({ path, start, lines }: NumberedLines): string {
  const lastLine = start + lines.length - 1
  const width = String(lastLine).length
  const numbered = lines.map(
    (text, offset) => `${String(start + offset).padStart(width)} | ${text}`,
  )

  return [path, ...numbered].join("\n")
}

/** "path:line: text" per match. */
export function formatMatches({ matches, truncated }: SearchResult): string {
  if (matches.length === 0) {
    return "no matches"
  }

  const lines = matches.map((match) => `${match.path}:${match.line}: ${match.text}`)
  const cut = truncated ? ["(more matches were cut: narrow the pattern)"] : []

  return [...lines, ...cut].join("\n")
}

/** "modified src/app.ts", "renamed src/old.ts -> src/new.ts", one file per line. */
export function formatFileChanges(files: FileChange[]): string {
  const describe = (file: FileChange) =>
    file.oldPath === undefined
      ? `${file.status} ${file.path}`
      : `${file.status} ${file.oldPath} -> ${file.path}`

  return files.map(describe).join("\n")
}
