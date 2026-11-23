import type { BranchChoices, ChangeChoice, OpenPullRequest } from "@srctrek/core"
import { count } from "../ui/text"

/** The headings the landing page's rows sit under, in the order they're listed. */
export type LandingGroup =
  | "YOUR WORK"
  | "WAITING ON YOUR REVIEW"
  | "OTHER PULL REQUESTS"
  | "OTHER BRANCHES"
  | "CODE AS IT IS"
  | "MORE REPOS"
  | "DONE"

/** A trek whose work has landed or gone, by its name and title, and how its work ended. */
export type DoneTrek = Readonly<{ name: string; title: string; why: string }>

/** What a row opens: a change, or a trek whose change is gone, by its name. */
export type Pick = ChangeChoice | Readonly<{ kind: "trek"; name: string; why: string }>

/**
 * A row of the landing page: under its heading, its name and what it holds, what it opens, and
 * that in words.
 */
export type LandingRow = Readonly<{
  group: LandingGroup
  label: string
  detail: string
  choice: Pick
  opens: string
}>

const since = (commits: number, base: string) => `${count(commits, "commit")} since ${base}`

// The user's own branch, then the same with what isn't committed yet, when there's any.
function ownRows({ base, own, uncommittedFiles }: BranchChoices): LandingRow[] {
  const name = own?.name ?? "the checked-out commit"
  const detail = own === undefined ? "not on a branch" : since(own.commits, base)
  const branch: LandingRow = {
    group: "YOUR WORK",
    label: name,
    detail,
    choice: { kind: "own", uncommitted: false },
    opens: `${name} · ${detail}`,
  }
  if (uncommittedFiles === 0) {
    return [branch]
  }

  const files = count(uncommittedFiles, "file")
  return [
    branch,
    {
      group: "YOUR WORK",
      label: "with uncommitted work",
      detail: `${files} changed`,
      choice: { kind: "own", uncommitted: true },
      opens: `${name} with ${files} not yet committed`,
    },
  ]
}

const otherBranchRows = (choices: BranchChoices): LandingRow[] =>
  choices.others.map((branch) => ({
    group: "OTHER BRANCHES",
    label: branch.name,
    detail: since(branch.commits, choices.base),
    choice: { kind: "branch", name: branch.name },
    opens: `${branch.name} · ${since(branch.commits, choices.base)}`,
  }))

/** Code as it is, with no change: opens on its ways in, where a trigger can be followed too. */
export const CODE_ROW: LandingRow = {
  group: "CODE AS IT IS",
  label: "its ways in",
  detail: "routes, events, and commands to follow",
  choice: { kind: "code" },
  opens: "code as it is · its ways in",
}

// Who opened it, and what sets it apart: waiting on the user's review, or still a draft.
function pullDetail(pr: OpenPullRequest): string {
  const marks = [pr.reviewRequested ? "review requested" : "", pr.draft ? "draft" : ""]
  return [pr.author, ...marks.filter(Boolean)].join(" · ")
}

/** The open pull requests, those waiting on the user's review apart from the rest. */
export function pullRequestRows(open: readonly OpenPullRequest[]): LandingRow[] {
  const row = (pr: OpenPullRequest): LandingRow => ({
    group: pr.reviewRequested ? "WAITING ON YOUR REVIEW" : "OTHER PULL REQUESTS",
    label: `#${pr.number} ${pr.title}`,
    detail: pullDetail(pr),
    choice: { kind: "pull-request", url: pr.url },
    opens: `pr ${pr.number} · ${pr.title} · by ${pr.author}`,
  })
  const waiting = open.filter((pr) => pr.reviewRequested)
  const others = open.filter((pr) => !pr.reviewRequested)

  return [...waiting.map(row), ...others.map(row)]
}

/** The treks whose work has landed or gone, each opened by its name. */
export const doneRows = (done: readonly DoneTrek[]): LandingRow[] =>
  done.map((trek) => ({
    group: "DONE",
    label: trek.title,
    detail: trek.why,
    choice: { kind: "trek", name: trek.name, why: trek.why },
    opens: `${trek.title} · ${trek.why}`,
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

  return [...own, ...pullRequestRows(pulls), ...others, CODE_ROW]
}

// A pick without the repos ticked to go with it.
function changeOnly(pick: Pick) {
  if (pick.kind === "trek") {
    return pick
  }

  const { repos: _repos, ...change } = pick
  return change
}

/** Whether two picks open the same thing in this repo, whatever repos go with it. */
export function samePick(a: Pick, b: Pick): boolean {
  return JSON.stringify(changeOnly(a)) === JSON.stringify(changeOnly(b))
}
