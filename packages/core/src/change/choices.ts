import { type TrekStatus, trekStatus } from "../build/status"
import { directoryIn } from "../files"
import { detectBase } from "../git/base"
import { checkedOutBranch } from "../git/refs"
import { runGit } from "../git/run"
import { readChangeArguments } from "./arguments"
import { resolveChange } from "./resolve"

/**
 * Which change trek is about, as the user chooses it on screen: their own branch (with or without
 * work not yet committed), another branch of the same repo, or what trek's arguments named.
 */
export type ChangeChoice = Readonly<
  | { kind: "own"; uncommitted: boolean }
  | { kind: "branch"; name: string }
  | { kind: "given"; args: readonly string[] }
>

/** trek's arguments for a choice; a branch is named as a range from the base, never as a folder. */
export function choiceArguments(choice: ChangeChoice): string[] {
  if (choice.kind === "own") {
    return choice.uncommitted ? ["--uncommitted"] : []
  }

  return choice.kind === "branch" ? [`...${choice.name}`] : [...choice.args]
}

/** The choice trek's arguments make: none, or only --uncommitted, is the user's own branch. */
export function choiceOfArguments(args: readonly string[]): ChangeChoice {
  if (args.length === 0) {
    return { kind: "own", uncommitted: false }
  }

  const onlyUncommitted = args.length === 1 && args[0] === "--uncommitted"
  return onlyUncommitted ? { kind: "own", uncommitted: true } : { kind: "given", args }
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

async function commitsSince(cwd: string, base: string, branch: string): Promise<number> {
  return Number(await runGit(cwd, ["rev-list", "--count", `${base}..${branch}`]))
}

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
      commits: await commitsSince(cwd, base, name),
    })),
  )
  const own =
    current === undefined
      ? undefined
      : { name: current, commits: await commitsSince(cwd, base, current) }

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
