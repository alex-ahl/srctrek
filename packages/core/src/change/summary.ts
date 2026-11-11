import { runGit } from "../git/run"
import { type RangeHead, rangeHead } from "./head"
import { type RepoWithRange, type ResolvedChange, hasRange } from "./resolve"

/** A repo the change touches: where its range starts and ends, and how many commits it spans. */
export type ChangedRepoSummary = Readonly<{
  repo: string
  base: string
  head: RangeHead
  commits: number
}>

/**
 * What a change is, for naming it on screen: the repos it touches, the repos it passes through
 * unchanged, and whether it's code as it is rather than a change.
 */
export type ChangeSummary = Readonly<{
  changed: readonly ChangedRepoSummary[]
  unchanged: readonly string[]
  code: boolean
}>

async function summarizeRepo(repo: RepoWithRange): Promise<ChangedRepoSummary> {
  const { base, baseCommit, headCommit } = repo.range
  const commits = await runGit(repo.dir, ["rev-list", "--count", `${baseCommit}..${headCommit}`])

  return { repo: repo.name, base, head: await rangeHead(repo), commits: Number(commits) }
}

export async function summarizeChange(change: ResolvedChange): Promise<ChangeSummary> {
  const changed = await Promise.all(change.repos.filter(hasRange).map(summarizeRepo))
  const unchanged = change.repos.filter((repo) => !hasRange(repo)).map((repo) => repo.name)

  return { changed, unchanged, code: change.code !== undefined }
}
