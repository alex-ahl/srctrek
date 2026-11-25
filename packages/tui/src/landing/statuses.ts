import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { LandingRow, PullHead } from "./rows"

/** A row's key, which keeps it selected while the lines around it come and go. */
export const rowKey = (row: LandingRow): string => JSON.stringify(row.choice)

/** How the landing page reads where each row's trek stands: a change's, and a pull request's. */
export type StatusOf = Readonly<{
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  pullStatus: (pr: PullHead) => Promise<TrekStatus>
}>

// Reading where a row's trek stands: a pull request's from its head as listed, as working out
// the change would fetch it first; none for a done trek's row, which says how its work ended.
function askOf(row: LandingRow, read: StatusOf): (() => Promise<TrekStatus>) | undefined {
  const { choice, pull } = row
  if (choice.kind === "trek") {
    return undefined
  }

  if (choice.kind === "pull-request") {
    return pull === undefined ? undefined : () => read.pullStatus(pull)
  }

  return () => read.status(choice)
}

/** Whether a row's trek state is read on the landing page. */
export const workedOut = (row: LandingRow) =>
  row.choice.kind !== "trek" && (row.choice.kind !== "pull-request" || row.pull !== undefined)

/** The key of the row a change is listed on, whatever repos are ticked to go with it. */
export function choiceKey(choice: ChangeChoice): string {
  const { repos: _repos, ...change } = choice
  return JSON.stringify(change)
}

/** Whether every row whose trek's state is worked out here has its state yet. */
export const statesKnown = (
  rows: readonly LandingRow[],
  statuses: ReadonlyMap<string, TrekStatus>,
): boolean => rows.every((row) => !workedOut(row) || statuses.has(rowKey(row)))

/** Each row's trek status as it's worked out; one that can't be worked out is left blank. */
export function useStatuses(
  rows: readonly LandingRow[],
  { status, pullStatus }: StatusOf,
): ReadonlyMap<string, TrekStatus> {
  const [found, setFound] = useState<ReadonlyMap<string, TrekStatus>>(new Map())
  useEffect(() => {
    let current = true
    for (const row of rows) {
      const ask = askOf(row, { status, pullStatus })
      if (ask === undefined) {
        continue
      }

      void ask().then(
        (each) => current && setFound((known) => new Map(known).set(rowKey(row), each)),
        () => undefined,
      )
    }

    return () => {
      current = false
    }
  }, [rows, status, pullStatus])

  return found
}
