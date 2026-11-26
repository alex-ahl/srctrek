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
  // the commit its branch is at now, and the branch, unless it's a fork's
  head: string
  branch?: string
  // the branch it would merge into
  base: string
  // when it last changed, and how many commits it holds
  updatedAt: string
  commits: number
}>

const ListedSchema = z.object({
  number: z.number(),
  title: z.string(),
  // none for a deleted account
  author: z.object({ login: z.string() }).nullable(),
  url: z.string(),
  isDraft: z.boolean(),
  headRefOid: z.string(),
  headRefName: z.string(),
  isCrossRepository: z.boolean(),
  baseRefName: z.string(),
  updatedAt: z.string(),
  commits: z.object({ totalCount: z.number() }),
})

const NodesSchema = z.object({ nodes: z.array(ListedSchema) })

const AnswerSchema = z.object({
  data: z.object({
    repository: z.object({ pullRequests: NodesSchema }),
    requested: NodesSchema,
    own: NodesSchema,
  }),
})

// Enough to find what's under review without paging through a busy repo's history, and, asked for
// on their own, every review asked of the user and every pull request of theirs, however old.
const LIMIT = "30"

// The three lists in one query, read again each minute while the landing page is open. GitHub
// prices a query by the lists it may have to fetch, so commits are asked for by their count: the
// commits themselves, each with its authors, as `gh pr list --json commits` asks, cost a hundred
// times more, and three such lists a minute spent a user's hourly allowance within the hour.
const QUERY = `query ($owner: String!, $name: String!, $requested: String!, $own: String!, $limit: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: $limit, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes { ...pr }
    }
  }
  requested: search(query: $requested, type: ISSUE, first: $limit) { nodes { ...pr } }
  own: search(query: $own, type: ISSUE, first: $limit) { nodes { ...pr } }
}
fragment pr on PullRequest {
  number title url isDraft headRefOid headRefName isCrossRepository baseRefName updatedAt
  author { login }
  commits { totalCount }
}`

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
    // gh api's own errors start "gh: " already
    const said = stderr.trim().split("\n")[0]?.replace(/^gh: /, "")
    throw new Error(`gh: ${said || `exited with ${code}`}`)
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

// A pull request as GitHub lists it, as trek names it.
const openPullRequest =
  ({ reviewRequested, mine }: Readonly<{ reviewRequested: boolean; mine: boolean }>) =>
  (pr: z.infer<typeof ListedSchema>): OpenPullRequest => ({
    number: pr.number,
    title: pr.title,
    author: pr.author?.login ?? "ghost",
    url: pr.url,
    draft: pr.isDraft,
    reviewRequested,
    mine,
    head: pr.headRefOid,
    ...(pr.isCrossRepository ? {} : { branch: pr.headRefName }),
    base: pr.baseRefName,
    updatedAt: pr.updatedAt,
    commits: pr.commits.totalCount,
  })

// The repo gh reads from each folder, "acme/api": asked once, as it doesn't change while trek
// runs; asked again after a failure, which may pass.
const repoNames = new Map<string, Promise<string>>()

function repoName(cwd: string, gh: string): Promise<string> {
  const known = repoNames.get(cwd)
  if (known !== undefined) {
    return known
  }

  const named = runGh(cwd, gh, ["repo", "view", "--json", "nameWithOwner"]).then(
    (answer) => z.object({ nameWithOwner: z.string() }).parse(answer).nameWithOwner,
  )
  named.catch(() => repoNames.delete(cwd))
  repoNames.set(cwd, named)
  return named
}

// The open pull requests, those waiting on the user's review, and the user's own, in one query.
async function listed(cwd: string, gh: string) {
  const repo = await repoName(cwd, gh)
  const [owner = "", name = ""] = repo.split("/")
  const open = `repo:${repo} is:pr is:open`
  const answer = await runGh(cwd, gh, [
    ...["api", "graphql", "-f", `query=${QUERY}`, "-f", `owner=${owner}`, "-f", `name=${name}`],
    ...["-f", `requested=${open} review-requested:@me`, "-f", `own=${open} author:@me`],
    ...["-F", `limit=${LIMIT}`],
  ])
  const { data } = AnswerSchema.parse(answer)
  return {
    all: data.repository.pullRequests.nodes,
    waiting: data.requested.nodes,
    own: data.own.nodes,
  }
}

/**
 * The open pull requests of the repo at `cwd`, through the user's own gh: every one waiting on
 * their review, however old, then their own, then the most recent of the rest, newest first, as gh
 * lists them.
 * Throws with gh's own words when it can't list them (not installed, not logged in, not a GitHub
 * repo).
 */
export async function openPullRequests(cwd: string, gh = "gh"): Promise<OpenPullRequest[]> {
  const { all, waiting, own } = await listed(cwd, gh)
  const requested = waiting.map(openPullRequest({ reviewRequested: true, mine: false }))
  const numbers = new Set(requested.map((pr) => pr.number))
  const mine = own
    .filter((pr) => !numbers.has(pr.number))
    .map(openPullRequest({ reviewRequested: false, mine: true }))
  const listedAbove = new Set([...numbers, ...mine.map((pr) => pr.number)])
  const rest = all
    .filter((pr) => !listedAbove.has(pr.number))
    .map(openPullRequest({ reviewRequested: false, mine: false }))

  return [...requested, ...mine, ...rest]
}
