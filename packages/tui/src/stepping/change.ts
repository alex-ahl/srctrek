import { type SteppingSession, rangeCommits, runGit } from "@srctrek/core"

/** A line of the change's diff for a file: added, removed, or as it was, and a hunk's start. */
export type DiffLine = Readonly<{ kind: "added" | "removed" | "same" | "hunk"; text: string }>

/** The change to `file` in `repo`, over the range the trek records, as diff lines; none for a repo with no range. */
export async function changeOf(
  session: SteppingSession,
  repoDir: string,
  repo: string,
  file: string,
): Promise<DiffLine[]> {
  const range = rangeCommits(session.trek.repos.find((each) => each.name === repo)?.range)
  if (range === undefined) {
    return []
  }

  const patch = await runGit(repoDir, ["diff", "--no-color", range.base, range.head, "--", file])
  return patch
    .split("\n")
    .filter(
      (line) =>
        line !== "" &&
        !/^(diff |index |--- |\+\+\+ |new file|deleted file|similarity|rename |old mode|new mode)/.test(
          line,
        ),
    )
    .map((line): DiffLine => {
      if (line.startsWith("@@")) {
        return { kind: "hunk", text: line }
      }

      const kind = line.startsWith("+") ? "added" : line.startsWith("-") ? "removed" : "same"
      return { kind, text: line.slice(1) }
    })
}
