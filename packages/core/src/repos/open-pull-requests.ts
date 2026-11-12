import { z } from "zod"

/** An open pull request to choose: its number, title, author, link, and whether it waits on you. */
export type OpenPullRequest = Readonly<{
  number: number
  title: string
  author: string
  url: string
  draft: boolean
  reviewRequested: boolean
}>

const ListedSchema = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    author: z.object({ login: z.string() }),
    url: z.string(),
    isDraft: z.boolean(),
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

/**
 * The open pull requests of the repo at `cwd`, through the user's own gh: those waiting on their
 * review first, then the rest newest first, as gh lists them. Throws with gh's own words when it
 * can't list them (not installed, not logged in, not a GitHub repo).
 */
export async function openPullRequests(cwd: string, gh = "gh"): Promise<OpenPullRequest[]> {
  const fields = ["--json", "number,title,author,url,isDraft", "--limit", LIMIT]
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
  }))

  return open.toSorted((a, b) => Number(b.reviewRequested) - Number(a.reviewRequested))
}
