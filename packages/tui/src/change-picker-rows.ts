import type { BranchChoices, ChangeChoice, OpenPullRequest } from "@srctrek/core"
import { count } from "./text"

/** The headings the picker's rows sit under, in the order they're listed. */
export type PickerGroup = "YOUR WORK" | "OTHER BRANCHES" | "PULL REQUESTS" | "MORE REPOS"

/**
 * A change the picker offers: under its heading, its name and what it holds, the choice it makes,
 * and what picking it opens, in words.
 */
export type PickerRow = Readonly<{
  group: PickerGroup
  label: string
  detail: string
  choice: ChangeChoice
  opens: string
}>

const since = (commits: number, base: string) => `${count(commits, "commit")} since ${base}`

// The user's own branch, then the same with what isn't committed yet, when there's any.
function ownRows({ base, own, uncommittedFiles }: BranchChoices): PickerRow[] {
  const name = own?.name ?? "the checked-out commit"
  const detail = own === undefined ? "not on a branch" : since(own.commits, base)
  const branch: PickerRow = {
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

/** The changes to choose from: the user's own work first, then the repo's other branches. */
export function pickerRows(choices: BranchChoices): PickerRow[] {
  const others = choices.others.map((branch): PickerRow => ({
    group: "OTHER BRANCHES",
    label: branch.name,
    detail: since(branch.commits, choices.base),
    choice: { kind: "branch", name: branch.name },
    opens: `${branch.name} · ${since(branch.commits, choices.base)}`,
  }))

  return [...ownRows(choices), ...others]
}

// Who opened it, and what sets it apart: waiting on the user's review, or still a draft.
function pullDetail(pr: OpenPullRequest): string {
  const marks = [pr.reviewRequested ? "review requested" : "", pr.draft ? "draft" : ""]
  return [pr.author, ...marks.filter(Boolean)].join(" · ")
}

/** The open pull requests to choose from, as gh lists them: those waiting on the user first. */
export function pullRequestRows(open: readonly OpenPullRequest[]): PickerRow[] {
  return open.map((pr) => ({
    group: "PULL REQUESTS",
    label: `#${pr.number} ${pr.title}`,
    detail: pullDetail(pr),
    choice: { kind: "pull-request", url: pr.url },
    opens: `pr ${pr.number} · ${pr.title} · by ${pr.author}`,
  }))
}

// A choice without the repos ticked to go with it.
function changeOnly({ repos: _repos, ...change }: ChangeChoice) {
  return change
}

/** Whether two choices pick the same change in this repo, whatever repos go with it. */
export function sameChange(a: ChangeChoice, b: ChangeChoice): boolean {
  return JSON.stringify(changeOnly(a)) === JSON.stringify(changeOnly(b))
}
