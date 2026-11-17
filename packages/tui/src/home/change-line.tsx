import { TextAttributes } from "@opentui/core"
import type { ChangeSummary, ChangedRepoSummary, RangeHead } from "@srctrek/core"
import { count, fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

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
  return `${count(repo.commits, "commit")}${since}`
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

  return [dim(" · with "), ...each]
}

function passedThrough(unchanged: readonly string[]): Part[] {
  return unchanged.length === 0 ? [] : [dim(" · "), plain(names(unchanged)), dim(" passed through")]
}

// Code as it is in the repo trek runs in, with the others, from the trigger the user named.
function codeParts(summary: ChangeSummary): Part[] {
  const [here = "", ...others] = summary.unchanged
  const along = others.length === 0 ? [] : [dim(" · with "), plain(names(others))]
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
    dim(` · ${sizeOf(first)}`),
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

/** The first line of the home screen's block: what's open, picked or given. */
export function ChangeLine({ summary, width }: { summary: ChangeSummary; width: number }) {
  const tones = useTones()

  return (
    <text fg={COLOUR.text}>
      {fittedParts(changeParts(summary), width).map((part, i) =>
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
