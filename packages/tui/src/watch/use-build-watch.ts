import type { TrekStatus } from "@srctrek/core"
import { useEffect } from "react"

/** A build takes minutes, so checking every couple of seconds is plenty. */
export const POLL_MS = 2000

/** Something is being built: the change's trek, or the trek of one of its triggers. */
export function isBuilding(status: TrekStatus | undefined): boolean {
  if (status?.kind === "triggers") {
    return status.triggers.some(({ trek }) => trek.kind === "building")
  }

  return status?.kind === "building"
}

/**
 * While the agent builds, checks on it every couple of seconds through `read` and hands on where
 * it stands; when it ends, `onEnded` is told first, as the treks it saved have changed the list too.
 */
export function useBuildWatch(
  status: TrekStatus | undefined,
  read: (() => Promise<TrekStatus>) | undefined,
  on: Readonly<{ status: (next: TrekStatus) => void; ended: () => Promise<void> }>,
): void {
  const building = isBuilding(status)

  useEffect(() => {
    if (!building || read === undefined) {
      return undefined
    }

    const refresh = async () => {
      const next = await read()
      if (next.kind !== "building") {
        await on.ended()
      }

      on.status(next)
    }
    const timer = setInterval(() => void refresh(), POLL_MS)

    return () => clearInterval(timer)
    // on's functions only set state; the check needs the ones it started with
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [building, read])
}
