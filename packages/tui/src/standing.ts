import type { ProposedRepo, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { Sources } from "./sources"
import type { ChangeOpen, Stacked } from "./stack"
import { useBuildWatch } from "./watch/use-build-watch"

type Front = (ChangeOpen & Readonly<{ id: number }>) | undefined

/**
 * Where the change in front stands, kept in its place on the stack by `setStatus`, and the repos
 * proposed: read as it comes to the front, again once work a key started is under way, and while
 * a build runs.
 */
export function useStanding(
  front: Front,
  sources: Sources,
  setStatus: (id: number, status: TrekStatus) => void,
) {
  const [proposals, setProposals] = useState<readonly ProposedRepo[]>([])
  const id = front?.id
  const readStatus = front?.change.status

  const readProposals = async () => setProposals(await sources.proposals())
  const readAll = async () => {
    if (id !== undefined && readStatus !== undefined) {
      setStatus(id, await readStatus())
    }

    await readProposals()
  }
  const run = (work: Promise<void>) => void work.then(readAll).catch(() => undefined)

  useEffect(() => {
    void readAll().catch(() => undefined)
    // what's read is the front change's; only another coming to the front asks again
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useBuildWatch(front?.status, readStatus, {
    status: (status) => id !== undefined && setStatus(id, status),
    ended: readProposals,
  })

  return { proposal: proposals[0], run, readProposals }
}

/** The change in front, when a change's screen is. */
export const changeInFront = (front: Stacked | undefined): Front =>
  front?.kind === "change" ? front : undefined
