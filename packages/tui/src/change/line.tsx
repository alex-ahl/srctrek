import { TextAttributes } from "@opentui/core"
import type {
  ChangeSummary,
  ChangedRepoSummary,
  PullRequestDetails,
  RangeHead,
} from "@srctrek/core"
import { count, fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { SEPARATOR } from "../ui/separator"

/** A piece of the line in its look: what was picked in bold, the rest plain or dim. */
export type Part = Readonly<{ text: string; look: "bold" | "plain" | "dim" }>

const bold = (text: string): Part => ({ text, look: "bold" })
const plain = (text: string): Part => ({ text, look: "plain" })
const dim = (text: string): Part => ({ text, look: "dim" })

// "feature/refunds", "feature/refunds + uncommitted", "pr 12".
function headLabel(head: RangeHead): string {
  if (head.kind === "branch") {
    return head.uncommitted ? `${head.name} + uncommitted` : head.name
  }

  return `${head.kind === "pull" ? "pr" : "mr"} ${head.number}`
}

// "3 commits since main"; a pull request's base is the host's, so it's left unsaid.
function sizeOf(repo: ChangedRepoSummary): string {
  const since = repo.head.kind === "branch" ? ` since ${repo.base}` : ""
  const commits = repo.commits === 0 ? "no commits" : count(repo.commits, "commit")
  return `${commits}${since}`
}

const names = (items: readonly string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`

// The other changed repos, each on its own head where it isn't the first's.
function withOthers(first: ChangedRepoSummary, others: readonly ChangedRepoSummary[]): Part[] {
  if (others.length === 0) {
    return []
  }

  const each = others.flatMap((repo, i) => {
    const head = headLabel(repo.head)
    const on = head === headLabel(first.head) ? [] : [dim(` on ${head}`)]
    return [...(i === 0 ? [] : [dim(", ")]), plain(repo.repo), ...on]
  })

  return [dim(`${SEPARATOR}with `), ...each]
}

function passedThrough(unchanged: readonly string[]): Part[] {
  return unchanged.length === 0
    ? []
    : [dim(SEPARATOR), plain(names(unchanged)), dim(" passed through")]
}

// Code as it is in the repo trek runs in, with the others, from the trigger the user named.
function codeParts(summary: ChangeSummary): Part[] {
  const [here = "", ...others] = summary.unchanged
  const along = others.length === 0 ? [] : [dim(`${SEPARATOR}with `), plain(names(others))]
  const from = summary.trigger === undefined ? [] : [dim(", from "), plain(`"${summary.trigger}"`)]

  return [bold("Code as it is"), dim(` in ${here}`), ...along, ...from]
}

/**
 * What's open, in full, for the line above its trek's state: the branch or pull request and its
 * size, the other repos it changes, and those it passes through; or code as it is.
 */
export function changeParts(summary: ChangeSummary): Part[] {
  if (summary.code) {
    return codeParts(summary)
  }

  const [first, ...others] = summary.changed
  if (first === undefined) {
    return passedThrough(summary.unchanged)
  }

  return [
    bold(headLabel(first.head)),
    dim(`${SEPARATOR}${sizeOf(first)}`),
    ...withOthers(first, others),
    ...passedThrough(summary.unchanged),
  ]
}

/** The parts cut to `width`: whole ones while they fit, then the next cut with an ellipsis. */
export function fittedParts(parts: readonly Part[], width: number): Part[] {
  return parts.reduce<{ room: number; kept: Part[] }>(
    ({ room, kept }, part) => {
      if (room <= 0) {
        return { room, kept }
      }

      const text = fit(part.text, room)
      return { room: room - text.length, kept: [...kept, { ...part, text }] }
    },
    { room: width, kept: [] },
  ).kept
}

// The parts in their looks: what was picked in bold, the rest plain or dim.
function PartsText({ parts }: { parts: readonly Part[] }) {
  const tones = useTones()
  return (
    <text fg={COLOUR.text}>
      {parts.map((part, i) =>
        part.look === "bold" ? (
          <span key={i} attributes={TextAttributes.BOLD}>
            {part.text}
          </span>
        ) : (
          <span key={i} fg={part.look === "dim" ? tones.dim : COLOUR.text}>
            {part.text}
          </span>
        ),
      )}
    </text>
  )
}

/** What's open, in full, on one line cut to `width`. */
export function ChangeLine({ summary, width }: { summary: ChangeSummary; width: number }) {
  return <PartsText parts={fittedParts(changeParts(summary), width)} />
}

// "#12 Add partial refunds" once the pull request's title is known, else as the change names it.
function titleOf(first: ChangedRepoSummary, details: PullRequestDetails | undefined): string {
  return first.head.kind === "pull" && details !== undefined
    ? `#${first.head.number} ${details.title}`
    : headLabel(first.head)
}

/**
 * The change's first line on its screen: the branch or pull request by its title, the other repos
 * it changes, and those it passes through; or code as it is.
 */
export function titleParts(
  summary: ChangeSummary,
  details: PullRequestDetails | undefined,
): Part[] {
  const [first, ...others] = summary.changed
  if (summary.code || first === undefined) {
    return changeParts(summary)
  }

  return [
    bold(titleOf(first, details)),
    ...withOthers(first, others),
    ...passedThrough(summary.unchanged),
  ]
}

// "9 commits since main" for one branch, the commits alone for a pull request; across repos, all
// of their commits.
function commitsText(changed: readonly ChangedRepoSummary[]): string {
  const [only] = changed
  if (changed.length === 1 && only !== undefined) {
    return sizeOf(only)
  }

  const commits = changed.reduce((sum, repo) => sum + repo.commits, 0)
  return commits === 0 ? "no commits" : count(commits, "commit")
}

/**
 * The change's second line: who opened a pull request and whether it's a draft, then how many
 * commits and files, each repo's files where there are several; none for code as it is.
 */
export function sizeText(
  summary: ChangeSummary,
  details: PullRequestDetails | undefined,
): string | undefined {
  const { changed } = summary
  if (summary.code || changed.length === 0) {
    return undefined
  }

  const who = details === undefined ? [] : [details.author, ...(details.draft ? ["draft"] : [])]
  const files = count(
    changed.reduce((sum, repo) => sum + repo.files, 0),
    "file",
  )
  const each =
    changed.length > 1 ? [changed.map((repo) => `${repo.repo} ${repo.files}`).join(", ")] : []
  return [...who, commitsText(changed), files, ...each].join(SEPARATOR)
}

// The lines the change adds and removes across its repos.
function linesOf(summary: ChangeSummary) {
  const total = (pick: (repo: ChangedRepoSummary) => number) =>
    summary.changed.reduce((sum, repo) => sum + pick(repo), 0)
  return { added: total((repo) => repo.added), removed: total((repo) => repo.removed) }
}

/**
 * The top of a change's screen: what the change is, then who opened it and how big it is, with
 * the lines it adds and removes in their colours.
 */
export function ChangeHeading({
  summary,
  details,
  width,
}: {
  summary: ChangeSummary
  details: PullRequestDetails | undefined
  width: number
}) {
  const tones = useTones()
  const size = sizeText(summary, details)
  const { added, removed } = linesOf(summary)
  const lines = `+${String(added)} −${String(removed)}`
  return (
    <box flexDirection="column">
      <PartsText parts={fittedParts(titleParts(summary, details), width)} />
      {size !== undefined && (
        <text fg={tones.dim}>
          {fit(size, width - SEPARATOR.length - lines.length)}
          {SEPARATOR}
          <span fg={tones.good}>{`+${String(added)}`}</span>
          <span fg={tones.bad}>{` −${String(removed)}`}</span>
        </text>
      )}
    </box>
  )
}
