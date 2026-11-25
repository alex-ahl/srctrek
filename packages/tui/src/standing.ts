import type { ProposedRepo, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { OpenChange } from "./change/open-change"
import type { Sources } from "./sources"
import type { Stacked } from "./stack"
import { useBuildWatch } from "./watch/use-build-watch"

/** The change on screen, by a key it keeps while it's shown, and where its trek last stood. */
export type Shown = Readonly<{ key: string; change: OpenChange; status: TrekStatus }> | undefined

/**
 * Where the change shown stands, kept where it's held by `setStatus`, and the repos proposed:
 * read as it's shown, again once work a key started is under way, and while a build runs.
 */
export function useStanding(
  shown: Shown,
  sources: Sources,
  setStatus: (status: TrekStatus) => void,
) {
  const [proposals, setProposals] = useState<readonly ProposedRepo[]>([])
  const key = shown?.key
  const readStatus = shown?.change.status

  const readProposals = async () => setProposals(await sources.proposals())
  const readAll = async () => {
    if (readStatus !== undefined) {
      setStatus(await readStatus())
    }

    await readProposals()
  }
  const run = (work: Promise<void>) => void work.then(readAll).catch(() => undefined)

  useEffect(() => {
    void readAll().catch(() => undefined)
    // what's read is the shown change's; only another being shown asks again
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useBuildWatch(shown?.status, readStatus, {
    status: setStatus,
    ended: readProposals,
  })

  return { proposal: proposals[0], run, readProposals }
}

/** The change in front, when a change's screen is, by its place on the stack. */
export const changeInFront = (front: Stacked | undefined): Shown =>
  front?.kind === "change"
    ? { key: String(front.id), change: front.change, status: front.status }
    : undefined
