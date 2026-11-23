import {
  type ChangeChoice,
  type PullRequestDetails,
  type Settings,
  choiceArguments,
} from "@srctrek/core"
import { useRef, useState } from "react"
import { canStep } from "./change/keys"
import { type Pending, failureReason } from "./opening"
import type { Sources } from "./sources"
import type { ChangeOpen, Screen } from "./stack"

// A change that opens within this comes up at once; one that takes longer says so meanwhile.
const OPENING_SHOWN_MS = 300

const after = (ms: number) =>
  new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))

/**
 * A pull request's title, who opened it, and whether it's a draft; none for any other change, or
 * when gh can't say, its screen then naming it by its number.
 */
export function detailsOf(
  choice: ChangeChoice,
  sources: Sources,
): Promise<PullRequestDetails | undefined> {
  return choice.kind === "pull-request"
    ? sources.pullRequest(choice.url).catch(() => undefined)
    : Promise.resolve(undefined)
}

/** The change a choice opens, worked out with all its screen first shows: its trek's overview too. */
async function prepare(choice: ChangeChoice, sources: Sources): Promise<Screen> {
  try {
    const change = await sources.open(choiceArguments(choice))
    const [status, details] = await Promise.all([change.status(), detailsOf(choice, sources)])
    const overview = canStep(status)
      ? await sources.overview(status.name).catch(() => undefined)
      : undefined
    return { kind: "change", choice, change, status, details, overview }
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

  await change.build()
  return { ...shown, status: await change.status() }
}

type Ways = Readonly<{
  sources: Sources
  settings: Settings
  open: (screen: Screen) => number
  replace: (id: number, screen: Screen) => void
}>

/**
 * Opening changes: the one the landing page's selection rests on worked out ahead, the latest
 * only, so enter opens it at once; a pick worked out while the landing page stays, which says so
 * when it takes a while, or why it couldn't open; a change followed from another screen behind an
 * opening screen when it takes a while. One at a time: a pick meanwhile waits for it.
 */
export function usePreparing({ sources, settings, open, replace }: Ways) {
  const ahead = useRef<{ key: string; screen: Promise<Screen> } | undefined>(undefined)
  const busy = useRef(false)
  // a change picked from the landing page being worked out, or why it couldn't be
  const [opening, setOpening] = useState<Pending | undefined>(undefined)

  const prepared = (choice: ChangeChoice) => {
    const key = JSON.stringify(choice)
    if (ahead.current?.key !== key) {
      ahead.current = { key, screen: prepare(choice, sources) }
    }

    return ahead.current.screen
  }

  // shown in front, built first where the settings say; worked out afresh next time
  const show = async (screen: Screen): Promise<Screen> => {
    ahead.current = undefined
    return screen.kind === "change" ? startedIfAutomatic(screen, settings) : screen
  }

  const openPicked = async (choice: ChangeChoice) => {
    const timer = setTimeout(() => setOpening({ kind: "opening", choice }), OPENING_SHOWN_MS)
    const screen = await prepared(choice)
    clearTimeout(timer)
    if (screen.kind === "pending") {
      ahead.current = undefined
      setOpening(screen.pending)
      return
    }

    setOpening(undefined)
    open(await show(screen))
  }

  const openFollowed = async (choice: ChangeChoice) => {
    const screen = prepared(choice)
    const quick = await Promise.race([screen, after(OPENING_SHOWN_MS)])
    if (quick !== undefined) {
      open(await show(quick))
      return
    }

    const id = open({ kind: "pending", pending: { kind: "opening", choice } })
    replace(id, await show(await screen))
  }

  return {
    opening,
    // the landing page's selection resting on a change, to work it out ahead
    rest: (choice: ChangeChoice) => void prepared(choice),
    // what's worked out ahead is out of date once the worktree moves on
    forget: () => {
      ahead.current = undefined
    },
    openChoice: (choice: ChangeChoice, fromLanding: boolean) => {
      if (busy.current) {
        return
      }

      busy.current = true
      const worked = fromLanding ? openPicked(choice) : openFollowed(choice)
      void worked.finally(() => {
        busy.current = false
      })
    },
  }
}
