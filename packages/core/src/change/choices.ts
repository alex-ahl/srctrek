import { type TrekStatus, trekStatus } from "../build/status"
import { directoryIn } from "../files"
import { detectBase } from "../git/base"
import { checkedOutBranch, commitsBetween } from "../git/refs"
import { runGit } from "../git/run"
import { parsePullRequestUrl } from "../repos/pull-request"
import { readChangeArguments } from "./arguments"
import { resolveChange } from "./resolve"

/**
 * A repo beside this one, ticked to go with the change: by its path, as changed or passed through
 * unchanged, and the branch chosen for it; without one, a changed repo is read on what it has
 * checked out, and one passed through at its default branch.
 */
export type RepoPick = Readonly<{ path: string; changed: boolean; branch?: string }>

/**
 * Which change trek is about, as the user chooses it on screen: their own branch (with or without
 * work not yet committed), another branch of the same repo, a pull request by its link, or what
 * trek's arguments named; with the repos beside it ticked to go along.
 */
export type ChangeChoice = Readonly<
  (
    | { kind: "own"; uncommitted: boolean }
    | { kind: "branch"; name: string }
    | { kind: "pull-request"; url: string }
    | { kind: "given"; args: readonly string[] }
  ) & { repos?: readonly RepoPick[] }
>

// A changed repo is read on its chosen branch, else what it has checked out, since it left its
// default branch; a range after a repo applies to it.
const repoArguments = (repos: readonly RepoPick[]) =>
  repos.flatMap((repo) => (repo.changed ? [repo.path, `...${repo.branch ?? "HEAD"}`] : [repo.path]))

/**
 * trek's arguments for a choice; a branch is named as a range from the base, never as a folder.
 * Repos ticked to go along follow it; with them, the user's own branch is named too, since trek
 * only reads it by default when given nothing else.
 */
export function choiceArguments(choice: ChangeChoice): string[] {
  const repos = choice.repos ?? []
  const change = changeArguments(choice)
  const own = choice.kind === "own" && repos.length > 0 ? ["...HEAD"] : []

  return [...change, ...own, ...repoArguments(repos)]
}

function changeArguments(choice: ChangeChoice): string[] {
  if (choice.kind === "own") {
    return choice.uncommitted ? ["--uncommitted"] : []
  }

  if (choice.kind === "branch") {
    return [`...${choice.name}`]
  }

  return choice.kind === "pull-request" ? [choice.url] : [...choice.args]
}

/**
 * The choice trek's arguments make: none, or only --uncommitted, is the user's own branch; one
 * pull request's link alone is that pull request.
 */
export function choiceOfArguments(args: readonly string[]): ChangeChoice {
  const [only] = args
  if (only === undefined) {
    return { kind: "own", uncommitted: false }
  }

  if (args.length > 1) {
    return { kind: "given", args }
  }

  if (only === "--uncommitted") {
    return { kind: "own", uncommitted: true }
  }

  return parsePullRequestUrl(only) === undefined
    ? { kind: "given", args }
    : { kind: "pull-request", url: only }
}

/** A branch to choose, and how many commits it has since it left the base. */
export type BranchChoice = Readonly<{ name: string; commits: number }>

/**
 * The branches of the repo at `cwd` to choose from: the base they're counted from, the one checked
 * out, the files changed and not yet committed there, and the others most recently committed to
 * first, leaving out the base and branches with nothing since it.
 */
export type BranchChoices = Readonly<{
  base: string
  own: BranchChoice | undefined
  uncommittedFiles: number
  others: readonly BranchChoice[]
}>

// Enough to find recent work without a git call per branch in a repo that keeps hundreds.
const OTHERS_LIMIT = 15

async function uncommittedFiles(cwd: string): Promise<number> {
  const status = await runGit(cwd, ["status", "--porcelain"])
  return status === "" ? 0 : status.split("\n").length
}

// Local branches, most recently committed to first.
async function localBranches(cwd: string): Promise<string[]> {
  const out = await runGit(cwd, [
    "for-each-ref",
    "--sort=-committerdate",
    "--format=%(refname:short)",
    "refs/heads",
  ])
  return out === "" ? [] : out.split("\n")
}

export async function branchChoices(cwd: string): Promise<BranchChoices> {
  const base = await detectBase(cwd)
  const current = await checkedOutBranch(cwd)
  const isBase = (name: string) => name === base || `origin/${name}` === base

  const names = (await localBranches(cwd)).filter((name) => name !== current && !isBase(name))
  const counted = await Promise.all(
    names.slice(0, OTHERS_LIMIT).map(async (name) => ({
      name,
      commits: await commitsBetween(cwd, base, name),
    })),
  )
  const own =
    current === undefined
      ? undefined
      : { name: current, commits: await commitsBetween(cwd, base, current) }

  return {
    base,
    own,
    uncommittedFiles: await uncommittedFiles(cwd),
    others: counted.filter((branch) => branch.commits > 0),
  }
}

/** Where the trek of a choice stands, worked out as trek would on opening that change. */
export async function choiceStatus(cwd: string, choice: ChangeChoice): Promise<TrekStatus> {
  const args = readChangeArguments(choiceArguments(choice), directoryIn(cwd))
  return trekStatus(cwd, await resolveChange(cwd, args))
}
