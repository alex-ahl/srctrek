import { type TrekEntry, type TrekStatus, buildProgress } from "@srctrek/core"
import { STATE_LABELS, type StateLabel } from "../ui/state-labels"
import { count } from "../ui/text"

/**
 * Where the change's trek stands, as the home screen shows it: a symbol and the state in the
 * state's tone, the trek's name and what it holds, then dim lines saying why.
 */
export type StatusBlock = StateLabel &
  Readonly<{
    name?: string
    holds?: string
    // a likely-wrong count, drawn in the bad colour
    flag?: string
    details: readonly string[]
  }>

// Enough of a build's log to see what it's doing or why it ended; l shows the rest.
const LOG_LINES = 3

/** What's open, as far as the block words it: a change, or code as it is from a trigger or not. */
export type Opened = Readonly<{ code: boolean; trigger?: string | undefined }>

const A_CHANGE: Opened = { code: false }

// Code as it is with no trigger named: the agent finds its ways in rather than building a trek.
const findsWaysIn = (open: Opened) => open.code && open.trigger === undefined

// What the agent does when b is pressed, in a reader's words.
function agentDoes(open: Opened): string {
  if (findsWaysIn(open)) {
    return "b has your agent find the routes, events, and commands that start things here"
  }

  return open.code
    ? "b builds one: your agent follows it through the code, as it runs"
    : "b builds one: your agent picks an example and follows it from its trigger to its outcome"
}

// A saved trek by its title; its file's name only when it can't be read.
const titleOf = (name: string, entry: TrekEntry | undefined) =>
  entry?.valid === true ? entry.title : name

type Of<K extends TrekStatus["kind"]> = Extract<TrekStatus, { kind: K }>

// The trek's title, "15 steps · 3 repos", and the flag, for a trek that's saved.
function readyBlock(name: string, entry: TrekEntry | undefined): StatusBlock {
  if (entry === undefined || !entry.valid) {
    return { ...STATE_LABELS.ready, name, details: [] }
  }

  return {
    ...STATE_LABELS.ready,
    name: entry.title,
    holds: `${count(entry.steps, "step")} · ${count(entry.repos, "repo")}`,
    ...(entry.highFlags > 0 ? { flag: `⚠ ${entry.highFlags} likely wrong` } : {}),
    details: [],
  }
}

function staleBlock(
  { name, staleStops, stops }: Of<"stale">,
  entry: TrekEntry | undefined,
): StatusBlock {
  const changed =
    staleStops === undefined
      ? "built at an older head of the pull request"
      : staleStops === 0
        ? "built at older commits, though none of its steps' files changed"
        : `${staleStops} of ${count(stops, "step")}' files changed since it was built`

  return {
    ...STATE_LABELS.stale,
    name: titleOf(name, entry),
    details: [changed],
  }
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
function unreachableBlock({ name, unreachable }: Of<"unreachable">): StatusBlock {
  const { repo, source, revision, reason } = unreachable
  const details =
    reason === "missing"
      ? [`repo ${repo} isn't at ${source}`, "clone it there to open this trek"]
      : [
          `repo ${repo} at ${source} has no commit ${revision.slice(0, 7)}`,
          "fetch it there to open this trek",
        ]

  return { ...STATE_LABELS.unreachable, name, details }
}

type NameOnly = "ready" | "older-guide" | "missing" | "empty"

// The states that are a name and nothing more.
function nameOnlyBlock(
  kind: NameOnly,
  name: string,
  entry: TrekEntry | undefined,
  canBuild: boolean,
  open: Opened,
): StatusBlock {
  if (kind === "ready") {
    return readyBlock(name, entry)
  }

  if (kind === "older-guide") {
    return {
      ...STATE_LABELS["older-guide"],
      name: titleOf(name, entry),
      details: ["built before the guide last changed"],
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

/**
 * The block for each state of the change's trek; `entry` is its saved trek, when listed, and
 * `open` what kind of thing it's a trek of.
 */
export function statusBlock(
  status: TrekStatus,
  entry: TrekEntry | undefined,
  canBuild: boolean,
  open: Opened = A_CHANGE,
): StatusBlock {
  if (status.kind === "building" || status.kind === "failed") {
    return buildBlock(status, canBuild, open)
  }

  if (status.kind === "stale") {
    return staleBlock(status, entry)
  }

  if (status.kind === "unreadable") {
    return {
      ...STATE_LABELS.unreadable,
      name: status.name,
      details: [status.problem],
    }
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

  return nameOnlyBlock(status.kind, status.name, entry, canBuild, open)
}
