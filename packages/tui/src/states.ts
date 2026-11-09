import type { TrekStatus } from "@srctrek/core"

type WithLog = Extract<TrekStatus, { kind: "building" | "failed" }>

// A build's log is worth reading while it runs, and after it failed.
export function hasLog(status: TrekStatus | undefined): status is WithLog {
  return status?.kind === "building" || status?.kind === "failed"
}

// A build can start when the change has no trek yet, its last build failed, its trek is out of
// date and can be updated, or its trek was built with an older guide or isn't valid and can be
// rebuilt.
const BUILDABLE: ReadonlySet<TrekStatus["kind"] | undefined> = new Set([
  "missing",
  "failed",
  "stale",
  "older-guide",
  "unreadable",
])

export function canStartBuild(status: TrekStatus | undefined): boolean {
  return BUILDABLE.has(status?.kind)
}

// A trek built with an older guide still opens; rebuilding it is the user's call.
export function hasTrek(status: TrekStatus | undefined): boolean {
  return status?.kind === "ready" || status?.kind === "older-guide"
}
