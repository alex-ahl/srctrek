import type { BuildProgress, BuildState } from "@srctrek/core"
import { STATE_LABELS, type StateLabel } from "../ui/state-labels"

/** A build as the view reads it each time it looks: its log, where it stands, and its clock. */
export type BuildRead = Readonly<{
  log: readonly string[]
  state: BuildState | undefined
  started: Date | undefined
  ended: Date | undefined
}>

/** "45s", "3m 40s", "1h 02m". */
export function durationText(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) {
    return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`
  }

  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`
}

/** How long it has run, "3m 40s", or ran, "after 4m 31s". */
export function clockText(read: BuildRead, now: Date): string {
  if (read.started === undefined) {
    return ""
  }

  const took = durationText((read.ended ?? now).getTime() - read.started.getTime())
  return read.ended === undefined ? took : `after ${took}`
}

const FINDING: StateLabel = { ...STATE_LABELS.building, state: "finding its ways in" }
const SAVED: StateLabel = { symbol: "●", state: "saved", tone: "good" }

/**
 * The build's state as the view's top says it: one the user stopped is stopped, not failed; code
 * with no trigger finds its ways in.
 */
export function buildLabel(
  state: BuildState | undefined,
  progress: BuildProgress,
  findsWaysIn: boolean,
): StateLabel {
  if (state === "done") {
    return SAVED
  }

  if (state === "failed") {
    return progress.stopped ? STATE_LABELS.stopped : STATE_LABELS.failed
  }

  return findsWaysIn ? FINDING : STATE_LABELS.building
}

/** Why the build ended without a trek, in the agent's last words. */
export function whyEnded(read: BuildRead): readonly string[] {
  const agents = read.log.filter((line) => line.trim() !== "" && !line.startsWith("trek: "))
  return agents.length === 0 ? ["its log says nothing more"] : agents.slice(-2)
}
