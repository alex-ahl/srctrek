import { runGit } from "./run"

export type FileChange = {
  path: string
  status: "added" | "modified" | "deleted" | "renamed"
  oldPath?: string // set for renames
}

export type LineChange = "added" | "changed"

const STATUS: Record<string, FileChange["status"]> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
}

// `git diff --name-status -z` output is a flat list of fields: a status code, then one path,
// or two for a rename. Records have to be read in order to know where each one ends.
function nameStatusRecords(fields: string[]): string[][] {
  const records: string[][] = []
  for (let i = 0; i < fields.length;) {
    const width = fields[i]?.startsWith("R") ? 3 : 2
    records.push(fields.slice(i, i + width))
    i += width
  }
  return records
}

function toFileChange([code = "", first = "", second = ""]: string[]): FileChange {
  const status = STATUS[code.charAt(0)] ?? "modified"
  return status === "renamed" ? { path: second, status, oldPath: first } : { path: first, status }
}

function parseNameStatus(out: string): FileChange[] {
  return nameStatusRecords(out.split("\0").filter(Boolean)).map(toFileChange)
}

/** Files that differ between two commits, renames detected. */
export async function changedFiles(cwd: string, from: string, to: string): Promise<FileChange[]> {
  return parseNameStatus(
    await runGit(cwd, ["diff", "--name-status", "--find-renames", "-z", from, to]),
  )
}

type Hunk = { removed: number; start: number; added: number }

// "@@ -12,3 +14,5 @@": 3 old lines (from line 12) replaced by 5 new ones (from line 14); a
// missing count means 1. Any other line isn't a hunk header.
function readHunk(line: string): Hunk | undefined {
  const match = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
  if (!match) return undefined
  return { removed: Number(match[1] ?? 1), start: Number(match[2]), added: Number(match[3] ?? 1) }
}

// The new version's lines a hunk touches: the first `removed` of them take the place of old
// lines, the rest are new.
function linesOfHunk({ removed, start, added }: Hunk): [number, LineChange][] {
  return Array.from({ length: added }, (_, i) => [start + i, i < removed ? "changed" : "added"])
}

/**
 * Lines of the new version a zero-context diff touches, by line number. Removed lines have no
 * number in the new version, so they aren't listed.
 */
export function parseChangedLines(diff: string): Map<number, LineChange> {
  const hunks = diff
    .split("\n")
    .map(readHunk)
    .filter((h) => h !== undefined)
  return new Map(hunks.flatMap(linesOfHunk))
}

/** The lines of `path` at `to` that differ from `from`; see parseChangedLines. */
export async function changedLines(
  cwd: string,
  from: string,
  to: string,
  path: string,
): Promise<Map<number, LineChange>> {
  return parseChangedLines(await runGit(cwd, ["diff", "--unified=0", from, to, "--", path]))
}
