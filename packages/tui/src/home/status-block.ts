import type { TrekEntry, TrekStatus } from "@srctrek/core"
import { STATE_LABELS, type StateLabel } from "../ui/state-labels"
import { count } from "../ui/text"

/**
 * Where the change's trek stands, as the home screen shows it: a symbol and the state in the
 * state's tone, the trek's name and what it holds, then dim lines saying why and the keys that
 * act on it.
 */
export type StatusBlock = StateLabel &
  Readonly<{
    name?: string
    holds?: string
    // a likely-wrong count, drawn in the bad colour
    flag?: string
    details: readonly string[]
    keys?: string
  }>

// Enough of a build's log to see what it's doing or why it ended; l shows the rest.
const LOG_LINES = 3

type Of<K extends TrekStatus["kind"]> = Extract<TrekStatus, { kind: K }>

// "15 steps · 3 repos", the flag, and the trek's title below it, for a trek that's saved.
function readyBlock(name: string, entry: TrekEntry | undefined): StatusBlock {
  if (entry === undefined || !entry.valid) {
    return { ...STATE_LABELS.ready, name, details: [] }
  }

  return {
    ...STATE_LABELS.ready,
    name,
    holds: `${count(entry.steps, "step")} · ${count(entry.repos, "repo")}`,
    ...(entry.highFlags > 0 ? { flag: `⚠ ${entry.highFlags} likely wrong` } : {}),
    details: [entry.title],
  }
}

function staleBlock({ name, staleStops, stops }: Of<"stale">, canBuild: boolean): StatusBlock {
  const changed =
    staleStops === 0
      ? "built at older commits, though none of its steps' files changed"
      : `${staleStops} of ${count(stops, "step")}' files changed since it was built`

  return {
    ...STATE_LABELS.stale,
    name,
    details: [changed],
    ...(canBuild ? { keys: "b update it" } : {}),
  }
}

function missingBlock(name: string, canBuild: boolean): StatusBlock {
  const block = { ...STATE_LABELS.missing, name }
  if (canBuild) {
    return { ...block, details: [], keys: "b build it" }
  }

  return {
    ...block,
    details: ["set an agent in settings, or ask your agent for a trek in chat"],
    keys: "S settings",
  }
}

function buildBlock(status: Of<"building" | "failed">, canBuild: boolean): StatusBlock {
  // trek mcp's own lines start "trek: ", which says nothing here
  const details = status.logTail.slice(-LOG_LINES).map((line) => line.replace(/^trek: /, ""))
  if (status.kind === "building") {
    return {
      ...STATE_LABELS.building,
      name: status.name,
      details,
      keys: "l log",
    }
  }

  return {
    ...STATE_LABELS.failed,
    name: status.name,
    details: details.length === 0 ? ["its log is empty"] : details,
    keys: canBuild ? "b build again · l whole log" : "l whole log",
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
): StatusBlock {
  if (kind === "ready") {
    return readyBlock(name, entry)
  }

  if (kind === "older-guide") {
    return {
      ...STATE_LABELS["older-guide"],
      name,
      details: ["built before the guide last changed"],
      keys: canBuild ? "b rebuild with the current guide · enter open it" : "enter open it",
    }
  }

  if (kind === "empty") {
    return {
      ...STATE_LABELS.empty,
      details: [
        "this change has no commits",
        "give trek a range, such as trek HEAD~5..HEAD, or try --uncommitted",
      ],
    }
  }

  return missingBlock(name, canBuild)
}

/** The block for each state of the change's trek; `entry` is its saved trek, when listed. */
export function statusBlock(
  status: TrekStatus,
  entry: TrekEntry | undefined,
  canBuild: boolean,
): StatusBlock {
  if (status.kind === "building" || status.kind === "failed") {
    return buildBlock(status, canBuild)
  }

  if (status.kind === "stale") {
    return staleBlock(status, canBuild)
  }

  if (status.kind === "unreadable") {
    return {
      ...STATE_LABELS.unreadable,
      name: status.name,
      details: [status.problem],
      ...(canBuild ? { keys: "b rebuild it" } : {}),
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
      details: ["pick one below to trek it"],
    }
  }

  return nameOnlyBlock(status.kind, status.name, entry, canBuild)
}

/** How many lines a block takes. */
export function blockLines(block: StatusBlock): number {
  return 1 + block.details.length + (block.keys === undefined ? 0 : 1)
}
