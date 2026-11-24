import { z } from "zod"

/** An open pull request to choose: its number, title, author, link, and whether it waits on you. */
export type OpenPullRequest = Readonly<{
  number: number
  title: string
  author: string
  url: string
  draft: boolean
  reviewRequested: boolean
  // the commit its branch is at now
  head: string
  // the branch it would merge into
  base: string
  // when it last changed, and how many commits it holds
  updatedAt: string
  commits: number
}>

const ListedSchema = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    author: z.object({ login: z.string() }),
    url: z.string(),
    isDraft: z.boolean(),
    headRefOid: z.string(),
    baseRefName: z.string(),
    updatedAt: z.string(),
    commits: z.array(z.unknown()),
  }),
)

const NumbersSchema = z.array(z.object({ number: z.number() }))

// Enough to find what's under review without paging through a busy repo's history.
const LIMIT = "30"

// Never ask: a prompt would hang behind the screen. Logging in is the user's own `gh auth login`.
const NO_PROMPT = { GH_PROMPT_DISABLED: "1" }

/** Runs gh in `cwd` and returns its stdout; throws with what gh said when it fails. */
async function runGh(cwd: string, gh: string, args: string[]): Promise<unknown> {
  const proc = Bun.spawn([gh, ...args], {
    cwd,
    env: { ...process.env, ...NO_PROMPT },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) {
    throw new Error(`gh: ${stderr.trim().split("\n")[0] ?? `exited with ${code}`}`)
  }

  return JSON.parse(stdout) as unknown
}

/** A pull request as its screen names it: its title, who opened it, and whether it's a draft. */
export type PullRequestDetails = Readonly<{ title: string; author: string; draft: boolean }>

const ViewedSchema = z.object({
  title: z.string(),
  author: z.object({ login: z.string() }),
  isDraft: z.boolean(),
})

/** The pull request at `url`, through the user's own gh; throws with gh's own words when it can't. */
export async function pullRequestOf(
  cwd: string,
  url: string,
  gh = "gh",
): Promise<PullRequestDetails> {
  const viewed = ViewedSchema.parse(
    await runGh(cwd, gh, ["pr", "view", url, "--json", "title,author,isDraft"]),
  )
  return { title: viewed.title, author: viewed.author.login, draft: viewed.isDraft }
}

/**
 * The open pull requests of the repo at `cwd`, through the user's own gh: those waiting on their
 * review first, then the rest newest first, as gh lists them. Throws with gh's own words when it
 * can't list them (not installed, not logged in, not a GitHub repo).
 */
export async function openPullRequests(cwd: string, gh = "gh"): Promise<OpenPullRequest[]> {
  const fields = [
    "--json",
    "number,title,author,url,isDraft,headRefOid,baseRefName,updatedAt,commits",
    "--limit",
    LIMIT,
  ]
  const [listed, waiting] = await Promise.all([
    runGh(cwd, gh, ["pr", "list", ...fields]),
    runGh(cwd, gh, ["pr", "list", "--search", "review-requested:@me", "--json", "number"]),
  ])
  const requested = new Set(NumbersSchema.parse(waiting).map((each) => each.number))

  const open = ListedSchema.parse(listed).map((pr): OpenPullRequest => ({
    number: pr.number,
    title: pr.title,
    author: pr.author.login,
    url: pr.url,
    draft: pr.isDraft,
    reviewRequested: requested.has(pr.number),
    head: pr.headRefOid,
    base: pr.baseRefName,
    updatedAt: pr.updatedAt,
    commits: pr.commits.length,
  }))

  return open.toSorted((a, b) => Number(b.reviewRequested) - Number(a.reviewRequested))
}
