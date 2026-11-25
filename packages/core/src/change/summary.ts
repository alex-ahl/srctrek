import { commitsBetween, filesBetween } from "../git/refs"
import { type RangeHead, rangeHead } from "./head"
import { type RepoWithRange, type ResolvedChange, hasRange } from "./resolve"

/**
 * A repo the change touches: where its range starts and ends, and how many commits it spans and
 * files it changes.
 */
export type ChangedRepoSummary = Readonly<{
  repo: string
  base: string
  head: RangeHead
  commits: number
  files: number
}>

/**
 * What a change is, for naming it on screen: the repos it touches, the repos it passes through
 * unchanged, and whether it's code as it is rather than a change, with the trigger it follows
 * when the user named one.
 */
export type ChangeSummary = Readonly<{
  changed: readonly ChangedRepoSummary[]
  unchanged: readonly string[]
  code: boolean
  trigger?: string
}>

/** Code as it is with no trigger named: building it finds its ways in rather than a trek. */
export const findsWaysIn = (summary: Readonly<{ code: boolean; trigger?: string | undefined }>) =>
  summary.code && summary.trigger === undefined

async function summarizeRepo(repo: RepoWithRange): Promise<ChangedRepoSummary> {
  const { base, baseCommit, headCommit } = repo.range
  const [commits, files] = await Promise.all([
    commitsBetween(repo.dir, baseCommit, headCommit),
    filesBetween(repo.dir, baseCommit, headCommit),
  ])

  return { repo: repo.name, base, head: await rangeHead(repo), commits, files }
}

export async function summarizeChange(change: ResolvedChange): Promise<ChangeSummary> {
  const changed = await Promise.all(change.repos.filter(hasRange).map(summarizeRepo))
  const unchanged = change.repos.filter((repo) => !hasRange(repo)).map((repo) => repo.name)

  const trigger = change.code?.trigger
  const code = { changed, unchanged, code: change.code !== undefined }

  return trigger === undefined ? code : { ...code, trigger }
}
