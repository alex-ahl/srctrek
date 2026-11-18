import {
  type SessionView,
  type StepView,
  type SteppingSession,
  type ViewContext,
  loadTrek,
  openSession,
  sessionView,
  stepBack,
  stepInto,
  stepNext,
  stepOut,
  stepOver,
  stepTo,
  trekPath,
  viewContext,
} from "@srctrek/core"
import { useEffect, useState } from "react"
import { type DiffLine, changeOf } from "./change"
import { type RouteStop, routeOf } from "./route"

/** A move through the trek, as the keys name them. */
export type Move = "next" | "previous" | "into" | "out" | "over"

const MOVES: Readonly<
  Record<Move, (session: SteppingSession, target?: string) => SteppingSession>
> = {
  next: stepNext,
  previous: stepBack,
  into: (session, target) => stepInto(session, target),
  out: stepOut,
  over: stepOver,
}

type Open = Readonly<{ session: SteppingSession; context: ViewContext }>

/** Stepping as it stands: opening, open with the view where the trek is, or why it couldn't. */
export type Stepping =
  | Readonly<{ kind: "opening" }>
  | Readonly<{
      kind: "open"
      view: SessionView
      move: (to: Move, target?: string) => void
      // straight to a step, by id, as details and the route map go
      go: (id: string) => void
      route: readonly RouteStop[]
      // where a repo of the trek is checked out
      dirOf: (repo: string) => string | undefined
      // the change to the stop's file, over the trek's range
      changeAt: (view: StepView) => Promise<DiffLine[]>
    }>
  | Readonly<{ kind: "failed"; why: string }>

/** The trek saved as `name` under `root`, opened at its overview and moved through by key. */
export function useStepping(root: string, name: string): Stepping {
  const [open, setOpen] = useState<Open | undefined>(undefined)
  const [why, setWhy] = useState<string | undefined>(undefined)

  useEffect(() => {
    let current = true
    const opening = async () => {
      const trek = await loadTrek(trekPath(root, name))
      return { session: openSession(trek), context: await viewContext(root, trek) }
    }

    opening().then(
      (opened) => current && setOpen(opened),
      (error: unknown) => current && setWhy(error instanceof Error ? error.message : String(error)),
    )
    return () => {
      current = false
    }
  }, [root, name])

  if (why !== undefined) {
    return { kind: "failed", why }
  }

  if (open === undefined) {
    return { kind: "opening" }
  }

  // `target`, for into, is the call to step into; without it, the first not visited
  const move = (to: Move, target?: string) =>
    setOpen((was) =>
      was === undefined ? was : { ...was, session: MOVES[to](was.session, target) },
    )
  const go = (id: string) =>
    setOpen((was) => (was === undefined ? was : { ...was, session: stepTo(was.session, id) }))
  const dirOf = (repo: string) => open.context.roots.get(repo)
  return {
    kind: "open",
    view: sessionView(open.session, open.context),
    move,
    go,
    route: routeOf(open.session),
    dirOf,
    changeAt: (view) => changeOf(open.session, dirOf(view.repo) ?? root, view.repo, view.file),
  }
}
