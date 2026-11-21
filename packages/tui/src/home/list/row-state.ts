import type { TrekEntry, TrekState, TrekStatus, UnreachableRepo } from "@srctrek/core"
import type { Row } from "./rows"
import { isChangeTrek } from "./change-trek"
import { statusBlock } from "../status-block"
import { STATE_LABELS, type StateLabel, doneLabel } from "../../ui/state-labels"
import { count } from "../../ui/text"

export type States = ReadonlyMap<string, TrekState>

// A saved trek's state as a row shows it; none while unchecked.
function savedLabel(state: TrekState | undefined): StateLabel | undefined {
  if (state === undefined || state.kind === "unchecked") {
    return undefined
  }

  if (state.kind === "current") {
    return STATE_LABELS.ready
  }

  if (state.kind === "stale") {
    return STATE_LABELS.stale
  }

  if (state.kind === "done") {
    return doneLabel(state.why)
  }

  return STATE_LABELS.unreachable
}

/**
 * Where a row stands, as far as it's known: a trigger's trek; the change's own trek, from the
 * change's status; a trek that isn't valid; any other trek, from its state once it's checked.
 */
export function stateOf(
  row: Row,
  status: TrekStatus | undefined,
  states: States,
): StateLabel | undefined {
  if (row.kind === "trigger") {
    return statusBlock(row.found.trek, undefined, false)
  }

  if (row.kind === "ways-in") {
    return row.status.kind === "missing"
      ? STATE_LABELS.notFound
      : statusBlock(row.status, undefined, false)
  }

  if (row.kind === "proposal") {
    return undefined
  }

  if (!row.entry.valid) {
    return STATE_LABELS.invalid
  }

  if (status !== undefined && isChangeTrek(row.entry.name, status)) {
    return statusBlock(status, row.entry, false)
  }

  return savedLabel(states.get(row.entry.name))
}

// "no worker at ../worker", "worker lacks 4f1c2a9".
function unreachableText({ repo, source, revision, reason }: UnreachableRepo): string {
  return reason === "missing" ? `no ${repo} at ${source}` : `${repo} lacks ${revision.slice(0, 7)}`
}

type Valid = Extract<TrekEntry, { valid: true }>

// What the change's own trek's status says beyond its word, when stale or unreachable.
function statusDetail(status: TrekStatus): string | undefined {
  if (status.kind === "stale") {
    return `${status.staleStops} of ${count(status.stops, "step")} changed`
  }

  return status.kind === "unreachable" ? unreachableText(status.unreachable) : undefined
}

// What another trek's state says beyond its word, when stale or unreachable.
function savedDetail(state: TrekState | undefined): string | undefined {
  if (state?.kind === "stale") {
    return `${state.staleStops} of ${count(state.stops, "step")} changed`
  }

  return state?.kind === "unreachable" ? unreachableText(state.unreachable) : undefined
}

/**
 * The column after a trek's title: what its state says beyond its word ("3 of 14 steps changed",
 * "no worker at ../worker"), else how many steps it has.
 */
export function detailOf(entry: Valid, status: TrekStatus | undefined, states: States): string {
  const own =
    status !== undefined && isChangeTrek(entry.name, status)
      ? statusDetail(status)
      : savedDetail(states.get(entry.name))

  return own ?? count(entry.steps, "step")
}
