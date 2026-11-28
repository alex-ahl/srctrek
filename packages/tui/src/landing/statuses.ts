import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { canStep } from "../change/keys"
import { POLL_MS, isBuilding } from "../watch/use-build-watch"
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

// Asks where each row's trek stands, handing each answer to `set` as it comes.
function askAll(
  rows: readonly LandingRow[],
  read: StatusOf,
  set: (key: string, status: TrekStatus) => void,
): void {
  for (const row of rows) {
    void askOf(row, read)?.().then(
      (each) => set(rowKey(row), each),
      () => undefined,
    )
  }
}

/**
 * Each row's trek status as it's worked out; one that can't be worked out is left blank. A row
 * whose trek is being built is read again every couple of seconds, so it shows the build ending
 * as soon as the change's own screen does.
 */
export function useStatuses(
  rows: readonly LandingRow[],
  { status, pullStatus }: StatusOf,
): ReadonlyMap<string, TrekStatus> {
  const [found, setFound] = useState<ReadonlyMap<string, TrekStatus>>(new Map())
  useEffect(() => {
    let current = true
    askAll(rows, { status, pullStatus }, (key, each) => {
      if (current) {
        setFound((known) => new Map(known).set(key, each))
      }
    })

    return () => {
      current = false
    }
  }, [rows, status, pullStatus])

  const building = rows.filter((row) => isBuilding(found.get(rowKey(row))))
  const buildingKey = JSON.stringify(building.map(rowKey))
  useEffect(() => {
    if (building.length === 0) {
      return undefined
    }

    let current = true
    const timer = setInterval(
      () =>
        askAll(building, { status, pullStatus }, (key, each) => {
          if (current) {
            setFound((known) => new Map(known).set(key, each))
          }
        }),
      POLL_MS,
    )
    return () => {
      current = false
      clearInterval(timer)
    }
    // read again only when other rows are building, which their key says
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingKey, status, pullStatus])

  return found
}

/**
 * The treks listed that the agent marked a step of as likely wrong, by name, as `flagged` reads
 * them: those that can be stepped, read again as they change or `flagged` is a new one.
 */
export function useFlagged(
  statuses: ReadonlyMap<string, TrekStatus>,
  flagged: ((name: string) => Promise<boolean>) | undefined,
): ReadonlySet<string> {
  const [found, setFound] = useState<ReadonlySet<string>>(new Set())
  const names = [...statuses.values()].filter(canStep).map((status) => status.name)
  const key = JSON.stringify(names)
  useEffect(() => {
    if (flagged === undefined) {
      return undefined
    }

    let current = true
    const flaggedName = async (name: string) =>
      (await flagged(name).catch(() => false)) ? [name] : []
    void Promise.all(names.map(flaggedName)).then(
      (each) => current && setFound(new Set(each.flat())),
    )
    return () => {
      current = false
    }
    // the names are read again only when they're other names, which their key says
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, flagged])

  return found
}
