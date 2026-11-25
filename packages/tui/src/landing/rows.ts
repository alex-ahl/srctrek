import type { BranchChoices, ChangeChoice, OpenPullRequest } from "@srctrek/core"
import { count } from "../ui/text"

/** The groups the landing page's rows sit in, by the names on their rules, in their order. */
export type LandingGroup = "your work" | "pull requests" | "branches" | "code as it is" | "done"

/** A trek whose work has landed or gone, by its name and title, and how its work ended. */
export type DoneTrek = Readonly<{ name: string; title: string; why: string }>

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
  pull?: Readonly<{ number: number; head: string }>
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

const otherBranchRows = (choices: BranchChoices): LandingRow[] =>
  choices.others.map((branch) => ({
    group: "branches",
    label: branch.name,
    detail: commitsOf(branch.commits),
    choice: { kind: "branch", name: branch.name },
  }))

/** Code as it is, with no change: opens on its ways in, where a trigger can be followed too. */
const CODE_ROW: LandingRow = {
  group: "code as it is",
  label: "its ways in",
  detail: "",
  choice: { kind: "code" },
}

// What a pull request holds: its commits, the branch it would merge into where that isn't the
// repo's own, and whether it's a draft: "3 commits · into release/2.1 · draft".
function pullDetail(pr: OpenPullRequest, base: string): string {
  const same = base === "" || pr.base === base.replace(/^origin\//, "")
  const into = same ? "" : `into ${pr.base}`
  return [count(pr.commits, "commit"), into, pr.draft ? "draft" : ""].filter(Boolean).join(" · ")
}

// The latest changed first.
const latestFirst = (prs: readonly OpenPullRequest[]) =>
  prs.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))

/**
 * The open pull requests, each group's latest changed first: those waiting on the user's review
 * with their own work, marked so, then the rest.
 */
export function pullRequestRows(open: readonly OpenPullRequest[], base: string): LandingRow[] {
  const row = (pr: OpenPullRequest): LandingRow => ({
    group: pr.reviewRequested ? "your work" : "pull requests",
    label: `#${pr.number} ${pr.title}`,
    detail: pullDetail(pr, base),
    ...(pr.reviewRequested ? { mark: "review requested" } : {}),
    choice: { kind: "pull-request", url: pr.url },
    pull: { number: pr.number, head: pr.head },
  })
  const waiting = open.filter((pr) => pr.reviewRequested)
  const others = open.filter((pr) => !pr.reviewRequested)

  return [...latestFirst(waiting).map(row), ...latestFirst(others).map(row)]
}

/** The treks whose work has landed or gone, each opened by its name. */
export const doneRows = (done: readonly DoneTrek[]): LandingRow[] =>
  done.map((trek) => ({
    group: "done",
    label: trek.title,
    detail: "",
    choice: { kind: "trek", name: trek.name, why: trek.why },
  }))

/**
 * The changes in the order they're listed: the user's own work, the pull requests, the other
 * branches, then code as it is.
 */
export function landingRows(
  choices: BranchChoices | undefined,
  pulls: readonly OpenPullRequest[],
): LandingRow[] {
  const own = choices === undefined ? [] : ownRows(choices)
  const others = choices === undefined ? [] : otherBranchRows(choices)

  return [...own, ...pullRequestRows(pulls, choices?.base ?? ""), ...others, CODE_ROW]
}
