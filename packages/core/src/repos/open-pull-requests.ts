import { z } from "zod"

/**
 * An open pull request to choose: its number, title, author, link, whether it waits on your
 * review, and whether it's yours.
 */
export type OpenPullRequest = Readonly<{
  number: number
  title: string
  author: string
  url: string
  draft: boolean
  reviewRequested: boolean
  mine: boolean
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

// Enough to find what's under review without paging through a busy repo's history, and, asked for
// on their own, every review asked of the user and every pull request of theirs, however old. More
// is refused: each pull request's commits and their authors count toward GitHub's 500,000 nodes a
// query, which 100 pull requests pass.
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

// A pull request as gh lists it, as trek names it.
const openPullRequest =
  ({ reviewRequested, mine }: Readonly<{ reviewRequested: boolean; mine: boolean }>) =>
  (pr: z.infer<typeof ListedSchema>[number]): OpenPullRequest => ({
    number: pr.number,
    title: pr.title,
    author: pr.author.login,
    url: pr.url,
    draft: pr.isDraft,
    reviewRequested,
    mine,
    head: pr.headRefOid,
    base: pr.baseRefName,
    updatedAt: pr.updatedAt,
    commits: pr.commits.length,
  })

/**
 * The open pull requests of the repo at `cwd`, through the user's own gh: every one waiting on
 * their review, however old, then their own, then the most recent of the rest, newest first, as gh
 * lists them.
 * Throws with gh's own words when it can't list them (not installed, not logged in, not a GitHub
 * repo).
 */
export async function openPullRequests(cwd: string, gh = "gh"): Promise<OpenPullRequest[]> {
  const fields = [
    "--json",
    "number,title,author,url,isDraft,headRefOid,baseRefName,updatedAt,commits",
  ]
  const [listed, waiting, own] = await Promise.all([
    runGh(cwd, gh, ["pr", "list", ...fields, "--limit", LIMIT]),
    runGh(cwd, gh, ["pr", "list", "--search", "review-requested:@me", ...fields, "--limit", LIMIT]),
    runGh(cwd, gh, ["pr", "list", "--author", "@me", ...fields, "--limit", LIMIT]),
  ])
  const requested = ListedSchema.parse(waiting).map(
    openPullRequest({ reviewRequested: true, mine: false }),
  )
  const numbers = new Set(requested.map((pr) => pr.number))
  const mine = ListedSchema.parse(own)
    .filter((pr) => !numbers.has(pr.number))
    .map(openPullRequest({ reviewRequested: false, mine: true }))
  const listedAbove = new Set([...numbers, ...mine.map((pr) => pr.number)])
  const rest = ListedSchema.parse(listed)
    .filter((pr) => !listedAbove.has(pr.number))
    .map(openPullRequest({ reviewRequested: false, mine: false }))

  return [...requested, ...mine, ...rest]
}
