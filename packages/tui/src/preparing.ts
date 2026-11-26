import {
  type ChangeChoice,
  type PullRequestDetails,
  type Settings,
  type TrekStatus,
  choiceArguments,
} from "@srctrek/core"
import { useRef, useState } from "react"
import { canStep } from "./change/keys"
import { type Pending, failureReason } from "./opening"
import type { Sources } from "./sources"
import type { ChangeOpen, Screen } from "./stack"
import { preparedKey, useWorkedOut } from "./worked-out"

// A change that opens within this comes up at once; one that takes longer says so meanwhile.
const OPENING_SHOWN_MS = 300

const after = (ms: number) =>
  new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))

/**
 * A pull request's title, who opened it, and whether it's a draft, asked of gh, for one named on
 * trek's command line rather than picked from the list; none for any other change, or when gh
 * can't say, its screen then naming it by its number.
 */
export function detailsOf(
  choice: ChangeChoice,
  sources: Sources,
): Promise<PullRequestDetails | undefined> {
  return choice.kind === "pull-request"
    ? sources.pullRequest(choice.url).catch(() => undefined)
    : Promise.resolve(undefined)
}

/**
 * The change a choice opens, worked out with all its screen first shows: its trek's overview too.
 * A pull request's title, author, and whether it's a draft come from the list it's picked from.
 */
async function prepare(choice: ChangeChoice, sources: Sources): Promise<Screen> {
  try {
    const change = await sources.open(choiceArguments(choice))
    const status = await change.status()
    const overview = canStep(status)
      ? await sources.overview(status.name).catch(() => undefined)
      : undefined
    return { kind: "change", choice, change, status, overview }
  } catch (error) {
    return { kind: "pending", pending: { kind: "failed", choice, why: failureReason(error) } }
  }
}

/**
 * A change as it's opened: its build started first when the settings build automatically and it
 * has no trek yet, so the screen comes up building. Never while it's only worked out ahead.
 */
export async function startedIfAutomatic(
  shown: ChangeOpen,
  settings: Settings,
): Promise<ChangeOpen> {
  const { change, status } = shown
  if (settings.build_automatically !== true || status.kind !== "missing" || !change.build) {
    return shown
  }

  // A build that can't start leaves the screen as it stands, as b's does, for b to try again.
  try {
    await change.build()
    return { ...shown, status: await change.status() }
  } catch {
    return shown
  }
}

/** The change the landing page's selection rests on, worked out, by the key of its choice. */
export type Rested = Readonly<{ key: string; choice: ChangeChoice; screen: Screen }>

type Ways = Readonly<{
  sources: Sources
  settings: Settings
  open: (screen: Screen) => number
  replace: (id: number, screen: Screen) => void
  // whether the landing page is in front, for a pick to open over it only
  landingInFront: () => boolean
}>

/**
 * Opening changes: those the landing page lists and the one its selection rests on worked out
 * ahead and kept, so the selection shows it, and enter opens it, at once; a pick worked out while
 * the landing page stays, which says so when it takes a while, or why it couldn't open, and opens
 * only over the landing page; a change followed from another screen behind an opening screen when
 * it takes a while. One at a time: a pick meanwhile waits for it.
 */
export function usePreparing({ sources, settings, open, replace, landingInFront }: Ways) {
  const worked = useWorkedOut((choice) => prepare(choice, sources))
  const busy = useRef(false)
  // a change picked from the landing page being worked out, or why it couldn't be
  const [opening, setOpening] = useState<Pending | undefined>(undefined)
  // the change the selection rests on, once worked out, for the landing page to show beside it
  const [rested, setRested] = useState<Rested | undefined>(undefined)
  // the choice last rested on, for forget, called from callbacks that outlive a render
  const restedOn = useRef<ChangeChoice | undefined>(undefined)

  // shown in front, built first where the settings say; worked out afresh next time, as its
  // screen moves on from here
  const show = async (choice: ChangeChoice, screen: Screen): Promise<Screen> => {
    worked.drop(preparedKey(choice))
    return screen.kind === "change" ? startedIfAutomatic(screen, settings) : screen
  }

  const openPicked = async (choice: ChangeChoice) => {
    const timer = setTimeout(() => setOpening({ kind: "opening", choice }), OPENING_SHOWN_MS)
    const screen = await worked.prepared(choice)
    clearTimeout(timer)
    if (screen.kind === "pending") {
      setOpening(screen.pending)
      return
    }

    setOpening(undefined)
    // a screen opened meanwhile is where the user went instead
    if (landingInFront()) {
      open(await show(choice, screen))
    }
  }

  const openFollowed = async (choice: ChangeChoice) => {
    const screen = worked.prepared(choice)
    const quick = await Promise.race([screen, after(OPENING_SHOWN_MS)])
    if (quick !== undefined) {
      open(await show(choice, quick))
      return
    }

    const id = open({ kind: "pending", pending: { kind: "opening", choice } })
    replace(id, await show(choice, await screen))
  }

  // what the selection rests on, once it's worked out, unless the selection has moved on
  // meanwhile: one worked out ahead answers before the next frame. A change of this repo kept
  // from before may have moved on since, as files are edited, so it's worked out again behind
  // it; a pull request is left to its fetch, too slow to repeat on every look.
  const rest = (choice: ChangeChoice) => {
    const key = preparedKey(choice)
    const kept = worked.kept(key)
    restedOn.current = choice
    const restOn = (screen: Screen) =>
      restedOn.current === choice && setRested({ key, choice, screen })

    void worked.prepared(choice).then(restOn)
    if (kept && choice.kind !== "pull-request") {
      worked.drop(key)
      void worked.prepared(choice).then(restOn)
    }
  }

  // where the trek of the change rested on stands now, kept with it
  const restedStatus = (status: TrekStatus) =>
    setRested((was) => {
      if (was?.screen.kind !== "change") {
        return was
      }

      const now = { ...was, screen: { ...was.screen, status } }
      worked.update(was.key, now.screen)
      return now
    })

  return {
    opening,
    rested,
    rest,
    restedStatus,
    // the changes the landing page lists, worked out in the background
    ahead: worked.ahead,
    // what's worked out ahead is out of date once the worktree moves on: the change rested on is
    // worked out again
    forget: () => {
      worked.forget()
      if (restedOn.current !== undefined) {
        rest(restedOn.current)
      }
    },
    openChoice: (choice: ChangeChoice, fromLanding: boolean) => {
      if (busy.current) {
        return
      }

      busy.current = true
      const opened = fromLanding ? openPicked(choice) : openFollowed(choice)
      void opened.finally(() => {
        busy.current = false
      })
    },
  }
}
