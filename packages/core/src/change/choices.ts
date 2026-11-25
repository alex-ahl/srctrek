import { detectBase, isBaseBranch } from "../git/base"
import { checkedOutBranch, commitsBetween } from "../git/refs"
import { runGit } from "../git/run"
import { parsePullRequestUrl } from "../repos/pull-request"

const CODE = "--code"

/**
 * A repo beside this one, ticked to go with the change: by its path, as changed or passed through
 * unchanged, and the branch chosen for it; without one, a changed repo is read on what it has
 * checked out, and one passed through at its default branch.
 */
export type RepoPick = Readonly<{ path: string; changed: boolean; branch?: string }>

/**
 * Which change trek is about, as the user chooses it on screen: their own branch (with or without
 * work not yet committed), another branch of the same repo, a pull request by its link, the code
 * as it is (from a trigger the user names, or finding its ways in), or what trek's arguments
 * named; with the repos beside it ticked to go along.
 */
export type ChangeChoice = Readonly<
  (
    | { kind: "own"; uncommitted: boolean }
    | { kind: "branch"; name: string }
    | { kind: "pull-request"; url: string }
    | { kind: "code"; trigger?: string }
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
  if (choice.kind === "code") {
    return codeArguments(choice.trigger, repos)
  }

  const change = changeArguments(choice)
  const own = choice.kind === "own" && repos.length > 0 ? ["...HEAD"] : []

  return [...change, ...own, ...repoArguments(repos)]
}

// Code as it is takes repos only, each read on what it has checked out; with any ticked, this repo
// is named too, since trek only reads it by default when given no repos.
function codeArguments(trigger: string | undefined, repos: readonly RepoPick[]): string[] {
  const option = trigger === undefined ? CODE : `${CODE}=${trigger}`
  const named = repos.length === 0 ? [] : [".", ...repos.map((repo) => repo.path)]

  return [option, ...named]
}

function changeArguments(choice: Exclude<ChangeChoice, { kind: "code" }>): string[] {
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
 * pull request's link alone is that pull request; --code alone is the code as it is.
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

  if (only === CODE || only.startsWith(`${CODE}=`)) {
    const trigger = only.slice(`${CODE}=`.length).trim()
    return trigger === "" ? { kind: "code" } : { kind: "code", trigger }
  }

  return parsePullRequestUrl(only) === undefined
    ? { kind: "given", args }
    : { kind: "pull-request", url: only }
}

/** A branch to choose, and how many commits it has since it left the base. */
export type BranchChoice = Readonly<{ name: string; commits: number }>

/** A branch besides the one checked out, and whether a commit on it since the base is the user's. */
export type OtherBranch = BranchChoice & Readonly<{ mine: boolean }>

/**
 * The branches of the repo at `cwd` to choose from: the base they're counted from, the one checked
 * out, the files changed and not yet committed there, and the others most recently committed to
 * first, each marked when a commit on it is the user's, leaving out the base and branches with
 * nothing since it.
 */
export type BranchChoices = Readonly<{
  base: string
  own: BranchChoice | undefined
  uncommittedFiles: number
  others: readonly OtherBranch[]
}>

// Enough to find recent work, the user's among it, without a git call per branch in a repo that
// keeps hundreds.
const OTHERS_LIMIT = 40

// Counted as the snapshot of them is taken: trek's own folder is no work of the user's.
async function uncommittedFiles(cwd: string): Promise<number> {
  const status = await runGit(cwd, ["status", "--porcelain", "--", ":/", ":(top,exclude).srctrek"])
  return status === "" ? 0 : status.split("\n").length
}

// The user's email, as their commits carry it; none when git has none set.
async function userEmail(cwd: string): Promise<string> {
  const email = await runGit(cwd, ["config", "user.email"]).catch(() => "")
  return email.toLowerCase()
}

// A branch's commits since the base, by who made them: how many, and whether one is the user's.
async function otherBranch(
  cwd: string,
  base: string,
  name: string,
  email: string,
): Promise<OtherBranch> {
  const out = await runGit(cwd, ["log", "--format=%ae", `${base}..${name}`])
  const authors = out === "" ? [] : out.split("\n")
  const mine = email !== "" && authors.some((author) => author.toLowerCase() === email)
  return { name, commits: authors.length, mine }
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

  const names = (await localBranches(cwd)).filter(
    (name) => name !== current && !isBaseBranch(base, name),
  )
  const email = await userEmail(cwd)
  const counted = await Promise.all(
    names.slice(0, OTHERS_LIMIT).map((name) => otherBranch(cwd, base, name, email)),
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
