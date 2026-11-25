import type { BranchChoices, ChangeChoice, OpenPullRequest, OtherBranch } from "@srctrek/core"
import { count } from "../ui/text"

/** The groups the landing page's rows sit in, by the names on their rules, in their order. */
export type LandingGroup =
  "your work" | "your branches" | "code as it is" | "pull requests" | "branches" | "done"

/** A trek whose work has landed or gone, by its name and title, and how its work ended. */
export type DoneTrek = Readonly<{ name: string; title: string; why: string }>

/** A pull request as its trek's state is read: its number, and the commit its branch is at. */
export type PullHead = Readonly<{ number: number; head: string }>

/** What a row opens: a change, or a trek whose change is gone, by its name. */
export type Pick = ChangeChoice | Readonly<{ kind: "trek"; name: string; why: string }>

/**
 * A row of the landing page: under its heading, its name and what it holds, and what it opens; a
 * pull request's row, its number and head, which its trek's state is read from.
 */
export type LandingRow = Readonly<{
  group: LandingGroup
  label: string
  detail: string
  choice: Pick
  // what sets it apart, drawn in the accent after what it holds: "review requested"
  mark?: string
  pull?: PullHead
}>

// What a branch holds, its base named once, in the title bar.
const commitsOf = (commits: number) => count(commits, "commit")

// The user's own branch, then the same with what isn't committed yet, when there's any.
function ownRows({ own, uncommittedFiles }: BranchChoices): LandingRow[] {
  const name = own?.name ?? "the checked-out commit"
  const detail = own === undefined ? "not on a branch" : commitsOf(own.commits)
  const branch: LandingRow = {
    group: "your work",
    label: name,
    detail,
    choice: { kind: "own", uncommitted: false },
  }
  if (uncommittedFiles === 0) {
    return [branch]
  }

  const files = count(uncommittedFiles, "file")
  return [
    branch,
    {
      group: "your work",
      label: "with uncommitted work",
      detail: `${files} changed`,
      choice: { kind: "own", uncommitted: true },
    },
  ]
}

// The user's branches listed with their work; the rest are on a view of their own.
const BRANCHES_SHOWN = 8

const branchRow =
  (group: LandingGroup) =>
  (branch: OtherBranch): LandingRow => ({
    group,
    label: branch.name,
    detail: commitsOf(branch.commits),
    choice: { kind: "branch", name: branch.name },
  })

// The names a pull request's branch goes by: checked out, and as only the remote has it.
const pullBranchNames = (pulls: readonly OpenPullRequest[]): ReadonlySet<string> =>
  new Set(
    pulls.flatMap((pr) => (pr.branch === undefined ? [] : [pr.branch, `origin/${pr.branch}`])),
  )

// The branches that aren't an open pull request's: a pull request's row stands for its branch.
function branchesBeside(
  choices: BranchChoices,
  pulls: readonly OpenPullRequest[],
): readonly OtherBranch[] {
  const pullBranches = pullBranchNames(pulls)
  return choices.others.filter((branch) => !pullBranches.has(branch.name))
}

// The user's own branches listed with their work: the latest first, the first few.
const yourBranches = (branches: readonly OtherBranch[]) =>
  branches.filter((branch) => branch.mine).slice(0, BRANCHES_SHOWN)

/** The other branches, on a view of their own: others', and the user's past the first few. */
export function otherBranchRows(
  choices: BranchChoices | undefined,
  pulls: readonly OpenPullRequest[],
): LandingRow[] {
  if (choices === undefined) {
    return []
  }

  const branches = branchesBeside(choices, pulls)
  const shown = new Set(yourBranches(branches).map((branch) => branch.name))
  return branches.filter((branch) => !shown.has(branch.name)).map(branchRow("branches"))
}

/** Code as it is, with no change: opens on its ways in, where a trigger can be followed too. */
const CODE_ROW: LandingRow = {
  group: "code as it is",
  label: "its ways in",
  detail: "",
  choice: { kind: "code" },
}

// What a pull request holds: its commits, the branch it would merge into where that isn't the
// repo's own, whether it's a draft, and whether it's the user's: "3 commits · into release/2.1 ·
// draft · yours".
function pullDetail(pr: OpenPullRequest, base: string): string {
  const same = base === "" || pr.base === base.replace(/^origin\//, "")
  const into = same ? "" : `into ${pr.base}`
  return [count(pr.commits, "commit"), into, pr.draft ? "draft" : "", pr.mine ? "yours" : ""]
    .filter(Boolean)
    .join(" · ")
}

// The latest changed first.
const latestFirst = (prs: readonly OpenPullRequest[]) =>
  prs.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))

const pullRow =
  (group: LandingGroup, base: string) =>
  (pr: OpenPullRequest): LandingRow => ({
    group,
    label: `#${pr.number} ${pr.title}`,
    detail: pullDetail(pr, base),
    ...(pr.reviewRequested ? { mark: "review requested" } : {}),
    choice: { kind: "pull-request", url: pr.url },
    pull: { number: pr.number, head: pr.head },
  })

/**
 * The pull requests listed with the user's work, each kind's latest changed first: their own,
 * then those waiting on their review, marked so.
 */
export function yourPullRows(open: readonly OpenPullRequest[], base: string): LandingRow[] {
  const mine = open.filter((pr) => pr.mine)
  const waiting = open.filter((pr) => pr.reviewRequested)
  return [...latestFirst(mine), ...latestFirst(waiting)].map(pullRow("your work", base))
}

/** The other pull requests, on a view of their own, the latest changed first. */
export const otherPullRows = (open: readonly OpenPullRequest[], base: string): LandingRow[] =>
  latestFirst(open.filter((pr) => !pr.mine && !pr.reviewRequested)).map(
    pullRow("pull requests", base),
  )

/** The treks whose work has landed or gone, each opened by its name. */
export const doneRows = (done: readonly DoneTrek[]): LandingRow[] =>
  done.map((trek) => ({
    group: "done",
    label: trek.title,
    detail: "",
    choice: { kind: "trek", name: trek.name, why: trek.why },
  }))

/**
 * The changes in the order they're listed: the user's own work, with their pull requests and
 * those waiting on their review; their own branches; then code as it is.
 */
export function landingRows(
  choices: BranchChoices | undefined,
  pulls: readonly OpenPullRequest[],
): LandingRow[] {
  const own = choices === undefined ? [] : ownRows(choices)
  const branches =
    choices === undefined
      ? []
      : yourBranches(branchesBeside(choices, pulls)).map(branchRow("your branches"))

  return [...own, ...yourPullRows(pulls, choices?.base ?? ""), ...branches, CODE_ROW]
}
