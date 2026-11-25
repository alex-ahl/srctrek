import { detectBase } from "../git/base"
import { checkedOutBranch, commitsBetween } from "../git/refs"
import { NO_PROMPT, runGit } from "../git/run"

/**
 * A branch of a repo to choose for it: its name ("refunds-v2", or "origin/refunds-v3" when only
 * the remote has it), when it was last committed to, by whom and what about, its commits since the
 * repo's default branch, and whether it's the one checked out or the user's own last commit.
 */
export type RepoBranch = Readonly<{
  name: string
  committedAt: string
  author: string
  mine: boolean
  subject: string
  commits: number
  checkedOut: boolean
}>

/** A repo's default branch, and its other branches most recently committed to first. */
export type RepoBranches = Readonly<{ base: string; branches: readonly RepoBranch[] }>

// Enough to find any recent work without a git call per branch in a repo that keeps hundreds.
const LIMIT = 50

const FIELDS = ["refname:short", "committerdate:iso-strict", "authoremail", "authorname", "subject"]

type Listed = Readonly<{
  name: string
  committedAt: string
  email: string
  author: string
  subject: string
}>

async function listed(dir: string): Promise<Listed[]> {
  const format = FIELDS.map((field) => `%(${field})`).join("%09")
  const out = await runGit(dir, [
    "for-each-ref",
    "--sort=-committerdate",
    `--format=${format}`,
    "refs/heads",
    "refs/remotes",
  ])

  return out === ""
    ? []
    : out.split("\n").map((line) => {
        const [name = "", committedAt = "", email = "", author = "", subject = ""] =
          line.split("\t")
        return { name, committedAt, email, author, subject }
      })
}

// Whether a name is a remote's branch, "origin/feature": a remote's name before the slash.
const remoteOf = (remotes: ReadonlySet<string>) => (name: string) =>
  remotes.has(name.split("/")[0] ?? "")

// A remote's copy of a branch the repo has locally, a remote's own HEAD, or the default branch
// itself: none of them a branch to choose.
function chooseable(branches: readonly Listed[], base: string, remotes: ReadonlySet<string>) {
  const isRemote = remoteOf(remotes)
  const short = (name: string) => (isRemote(name) ? name.slice(name.indexOf("/") + 1) : name)
  const local = new Set(branches.filter((b) => !isRemote(b.name)).map((b) => b.name))
  const baseName = short(base)

  return (branch: Listed) => {
    const remoteCopy = isRemote(branch.name) && local.has(short(branch.name))
    // a remote's own HEAD shortens to the remote's name alone, "origin"
    const remoteHead = remotes.has(branch.name)
    return !remoteHead && !remoteCopy && short(branch.name) !== baseName
  }
}

/**
 * The branches of the repo at `dir` to choose from: its default branch, and the rest, local and
 * remote, most recently committed to first. Reads what the repo has; fetching is the user's call.
 */
export async function repoBranches(dir: string): Promise<RepoBranches> {
  const [base, current, email, remoteNames, all] = await Promise.all([
    detectBase(dir),
    checkedOutBranch(dir),
    runGit(dir, ["config", "user.email"]).catch(() => ""),
    runGit(dir, ["remote"]).catch(() => ""),
    listed(dir),
  ])
  const remotes = new Set(remoteNames.split("\n").filter(Boolean))
  const kept = all.filter(chooseable(all, base, remotes)).slice(0, LIMIT)
  const branches = await Promise.all(
    kept.map(async (branch) => ({
      name: branch.name,
      committedAt: branch.committedAt,
      author: branch.author,
      mine: email !== "" && branch.email === `<${email}>`,
      subject: branch.subject,
      commits: await commitsBetween(dir, base, branch.name),
      checkedOut: branch.name === current,
    })),
  )

  return { base, branches }
}

/** Fetches the repo at `dir` from its remotes, never asking for a password. */
export async function fetchRepo(dir: string): Promise<void> {
  await runGit(dir, ["fetch", "--quiet", "--all", "--prune"], NO_PROMPT)
}
