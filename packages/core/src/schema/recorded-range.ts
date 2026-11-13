/** A changed repo's range as a trek records it: its exact commits, "9c1e2f3…..1a2b3c4…". */
export function recordedRange(baseCommit: string, headCommit: string): string {
  return `${baseCommit}..${headCommit}`
}

/** The commits a recorded range runs between; none when there's no range to read. */
export function rangeCommits(
  range: string | undefined,
): Readonly<{ base: string; head: string }> | undefined {
  const [base, head] = range?.split(/\.{2,3}/) ?? []
  return base === undefined || head === undefined ? undefined : { base, head }
}
