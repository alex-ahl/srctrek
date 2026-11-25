import {
  type BranchChoices,
  type ChangeChoice,
  type NearbyCheckout,
  type OpenPullRequest,
  type TrekEntry,
  type TrekStatus,
  errorText,
} from "@srctrek/core"
import { useEffect, useMemo, useRef, useState } from "react"
import type { LandingNote } from "./list"
import { type StatusOf, statesKnown, useStatuses } from "./statuses"
import { type DoneTrek, doneRows, landingRows, otherBranchRows, otherPullRows } from "./rows"

/** What the landing page lists, and where each listed change's trek stands. */
export type LandingSources = {
  // the changes to list: the branches, the open pull requests, the repos beside this one
  load: () => Promise<BranchChoices>
  pullRequests: () => Promise<OpenPullRequest[]>
  nearby: () => Promise<NearbyCheckout[]>
  // where the trek of each change stands, filled in as each is worked out
  status: (choice: ChangeChoice) => Promise<TrekStatus>
  pullStatus: StatusOf["pullStatus"]
  // the saved treks, for when each was built
  entries: () => Promise<TrekEntry[]>
  // how often the pull requests are read again while the page is in front
  pullsEvery?: number | undefined
  // the treks whose work has landed or gone
  done: () => Promise<DoneTrek[]>
  // whether the page is in front: behind another screen it keeps where it was, drawing nothing
  // and taking no keys, so going back finds it at once as it was left
  active?: boolean | undefined
}

/** What a load holds as it answers: nothing yet, what it found, or why it couldn't. */
type Loaded<T> =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; found: T }>
  | Readonly<{ kind: "failed"; why: string }>

/**
 * What `load` answers; asked again when `load` is a new one, and every `every` ms while given. A
 * read again that fails keeps what was found, so a moment offline doesn't empty the list.
 */
function useLoaded<T>(load: () => Promise<T>, every?: number): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ kind: "loading" })
  const reading = useRef<() => void>(undefined)
  useEffect(() => {
    let current = true
    const read = () =>
      void load().then(
        (found) => current && setLoaded({ kind: "ready", found }),
        (error: unknown) =>
          current &&
          setLoaded((was) =>
            was.kind === "ready" ? was : { kind: "failed", why: errorText(error) },
          ),
      )
    reading.current = read
    read()

    return () => {
      current = false
    }
  }, [load])

  // its own effect, so `every` coming and going starts and stops the asking, not a read
  useEffect(() => {
    if (every === undefined) {
      return undefined
    }

    const timer = setInterval(() => reading.current?.(), every)
    return () => clearInterval(timer)
  }, [every])

  return loaded
}

// Often enough that a pull request pushed to shows its trek stale soon after, one request a time.
const PULLS_EVERY_MS = 60_000

const foundOr = <T>(loaded: Loaded<T>, none: T): T =>
  loaded.kind === "ready" ? loaded.found : none

// The pull requests, with none to open yet: still asking, none, or why they can't be listed.
function pullsNote(pulls: Loaded<OpenPullRequest[]>): LandingNote | undefined {
  const group = "pull requests"
  if (pulls.kind === "loading") {
    return { group, text: "finding pull requests…", tone: "dim" }
  }

  if (pulls.kind === "failed") {
    return { group, text: `✕ ${pulls.why}`, tone: "bad" }
  }

  return pulls.found.length === 0 ? { group, text: "none", tone: "dim" } : undefined
}

// Past this, the page is drawn with what it has, the rest filling its place as it comes, rather
// than kept back any longer, as by a host slow to list its pull requests.
const REVEAL_WAIT_MS = 1500

/**
 * Whether the page is drawn yet: once everything it lists has answered, or the wait is up; and
 * from then on, as what's read again only replaces what's shown.
 */
function useSettled(loads: readonly Loaded<unknown>[], known: boolean): boolean {
  const [waited, setWaited] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const ready = known && loads.every((loaded) => loaded.kind !== "loading")
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), REVEAL_WAIT_MS)
    return () => clearTimeout(timer)
  }, [])
  // remembered as it's first drawn, so a row read later, its state not known yet, never hides it
  if ((ready || waited) && !drawn) {
    setDrawn(true)
  }

  return drawn || ready || waited
}

// The changes as each list answers, and where each one's trek stands; one that can't be read
// leaves the others listed. The page is drawn once all of it is in, so it appears whole, in one
// frame, rather than growing and shifting as each list answers.
export function useRows(props: LandingSources) {
  const branches = useLoaded(props.load)
  const pulls = useLoaded(
    props.pullRequests,
    props.active === false ? undefined : (props.pullsEvery ?? PULLS_EVERY_MS),
  )
  const done = useLoaded(props.done)
  const nearby = useLoaded(props.nearby)
  const entries = useLoaded(props.entries)
  const builtAt = useMemo(() => builtTimes(foundOr(entries, [])), [entries])
  const { rows, otherPulls, otherBranches, all } = useMemo(() => {
    const choices = foundOr(branches, undefined)
    const open = foundOr(pulls, [])
    const listed = landingRows(choices, open)
    const pullsBesides = otherPullRows(open, choices?.base ?? "")
    const branchesBesides = otherBranchRows(choices, open)
    return {
      rows: listed,
      otherPulls: pullsBesides,
      otherBranches: branchesBesides,
      all: [...listed, ...pullsBesides, ...branchesBesides],
    }
  }, [branches, pulls])
  // the others' states are read too, for their views, though the page doesn't wait on them
  const statuses = useStatuses(all, { status: props.status, pullStatus: props.pullStatus })
  const settled = useSettled([branches, done, nearby, pulls], statesKnown(rows, statuses))

  return {
    settled,
    statuses,
    builtAt,
    branches,
    rows,
    otherPulls,
    otherBranches,
    done: doneRows(foundOr(done, [])),
    nearby: foundOr(nearby, []),
    note: pullsNote(pulls),
  }
}

// When each saved trek was built, by its name; one that can't be read has no time.
const builtTimes = (entries: readonly TrekEntry[]): ReadonlyMap<string, string> =>
  new Map(entries.flatMap((entry) => (entry.valid ? [[entry.name, entry.createdAt] as const] : [])))
