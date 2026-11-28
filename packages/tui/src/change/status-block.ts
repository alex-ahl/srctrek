import { type TrekStatus, buildProgress, findsWaysIn } from "@srctrek/core"
import { STATE_LABELS, type StateLabel } from "../ui/state-labels"
import { count } from "../ui/text"

/**
 * Where the change's trek stands, as its screen shows it: a symbol and the state in the state's
 * tone, then dim lines saying why.
 */
export type StatusBlock = StateLabel & Readonly<{ details: readonly string[] }>

// Enough of a build's log to see what it's doing or why it ended; l shows the rest.
const LOG_LINES = 3

/** What's open, as far as the block words it: a change, or code as it is from a trigger or not. */
export type Opened = Readonly<{ code: boolean; trigger?: string | undefined }>

const A_CHANGE: Opened = { code: false }

// What the agent does when b is pressed, in a reader's words.
function agentDoes(open: Opened): string {
  if (findsWaysIn(open)) {
    return "b has your agent find the routes, events, and commands that start things here"
  }

  return open.code
    ? "b builds one: your agent follows it through the code, as it runs"
    : "b builds one: your agent picks an example and follows it from its trigger to its outcome"
}

type Of<K extends TrekStatus["kind"]> = Extract<TrekStatus, { kind: K }>

function staleBlock({ staleStops, stops }: Of<"stale">): StatusBlock {
  const changed =
    staleStops === undefined
      ? "built at an older head of the pull request"
      : staleStops === 0
        ? "built at older commits, though none of its steps' files changed"
        : `${staleStops} of ${count(stops, "step")}' files changed since it was built`

  return { ...STATE_LABELS.stale, details: [changed] }
}

const NOT_FOUND: StateLabel = { symbol: "○", state: "ways in not found yet", tone: "dim" }

// Nothing built yet: what the agent would do, and the key that starts it.
function missingBlock(canBuild: boolean, open: Opened): StatusBlock {
  const label = findsWaysIn(open) ? NOT_FOUND : STATE_LABELS.missing
  if (!canBuild) {
    return {
      ...label,
      details: ["set an agent in settings, or ask your agent for a trek in chat"],
    }
  }

  return { ...label, details: [agentDoes(open)] }
}

const FINDING: StateLabel = { ...STATE_LABELS.building, state: "finding its ways in" }

function buildBlock(
  status: Of<"building" | "failed">,
  canBuild: boolean,
  open: Opened,
): StatusBlock {
  // trek mcp's own lines start "trek: ", which says nothing here
  const details = status.logTail.slice(-LOG_LINES).map((line) => line.replace(/^trek: /, ""))
  if (status.kind === "building") {
    // the build view has the detail; here it's enough that it's going
    return {
      ...(findsWaysIn(open) ? FINDING : STATE_LABELS.building),
      details: [],
    }
  }

  // a build the user stopped ended as they asked; it didn't fail
  if (buildProgress(status.logTail).stopped) {
    return {
      ...STATE_LABELS.stopped,
      details: [],
    }
  }

  return {
    ...STATE_LABELS.failed,
    details: details.length === 0 ? ["its log is empty"] : details,
  }
}

// What can't be opened and where it was looked for; fixing it is the user's, so no key acts on it.
function unreachableBlock({ unreachable }: Of<"unreachable">): StatusBlock {
  const { repo, source, revision, reason } = unreachable
  const details =
    reason === "missing"
      ? [`repo ${repo} isn't at ${source}`, "clone it there to open this trek"]
      : [
          `repo ${repo} at ${source} has no commit ${revision.slice(0, 7)}`,
          "fetch it there to open this trek",
        ]

  return { ...STATE_LABELS.unreachable, details }
}

type NameOnly = "ready" | "older-guide" | "newer-guide" | "missing" | "empty"

// The states that are a name and nothing more.
function nameOnlyBlock(kind: NameOnly, canBuild: boolean, open: Opened): StatusBlock {
  if (kind === "ready") {
    return { ...STATE_LABELS.ready, details: [] }
  }

  if (kind === "older-guide") {
    return { ...STATE_LABELS["older-guide"], details: ["built before the guide last changed"] }
  }

  if (kind === "newer-guide") {
    return {
      ...STATE_LABELS["newer-guide"],
      details: ["built by a newer trek: restart trek to see it"],
    }
  }

  if (kind === "empty") {
    return {
      ...STATE_LABELS.empty,
      details: [],
    }
  }

  return missingBlock(canBuild, open)
}

/** The block for each state of the change's trek; `open` is what kind of thing it's a trek of. */
export function statusBlock(
  status: TrekStatus,
  canBuild: boolean,
  open: Opened = A_CHANGE,
): StatusBlock {
  if (status.kind === "building" || status.kind === "failed") {
    return buildBlock(status, canBuild, open)
  }

  if (status.kind === "stale") {
    return staleBlock(status)
  }

  if (status.kind === "unreadable") {
    return { ...STATE_LABELS.unreadable, details: [status.problem] }
  }

  if (status.kind === "unreachable") {
    return unreachableBlock(status)
  }

  if (status.kind === "triggers") {
    return {
      symbol: "◇",
      state: `found ${count(status.triggers.length, "way")} in`,
      tone: "accent",
      details: ["enter on one treks it, or opens its trek once built"],
    }
  }

  return nameOnlyBlock(status.kind, canBuild, open)
}
