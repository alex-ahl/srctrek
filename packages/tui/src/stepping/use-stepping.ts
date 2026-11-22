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
import { type RouteStop, hiddenBy, routeOf, stepPast } from "./route"

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

/** The stop the trek is on in the route, and those n and p go to; none past either end. */
export type Near = Readonly<{ at: number; next: number | undefined; previous: number | undefined }>

// Where the trek is in the route; before the first stop at the overview, past the last at the end.
function nearOf(view: SessionView, route: readonly RouteStop[], hidden: ReadonlySet<string>): Near {
  if (view.kind === "overview") {
    return { at: -1, next: route.length > 0 ? 0 : undefined, previous: undefined }
  }

  const at = view.kind === "step" ? route.findIndex((stop) => stop.id === view.id) : route.length
  return { at, next: stepPast(route, at, hidden, 1), previous: stepPast(route, at, hidden, -1) }
}

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
      // where the trek is in the route, and the stops n and p go to, past folded calls
      near: Near
      // the calls folded in the route map, whose stops n and p step past
      folded: ReadonlySet<string>
      fold: (id: string, folded: boolean) => void
      // where a repo of the trek is checked out
      dirOf: (repo: string) => string | undefined
      // the change to the stop's file, over the trek's range
      changeAt: (view: StepView) => Promise<DiffLine[]>
    }>
  | Readonly<{ kind: "failed"; why: string }>

/** The trek saved as `name` under `root`, opened at its first stop and moved through by key. */
export function useStepping(root: string, name: string): Stepping {
  const [open, setOpen] = useState<Open | undefined>(undefined)
  const [why, setWhy] = useState<string | undefined>(undefined)
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let current = true
    const opening = async () => {
      const trek = await loadTrek(trekPath(root, name))
      return { session: stepNext(openSession(trek)), context: await viewContext(root, trek) }
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

  const view = sessionView(open.session, open.context)
  const route = routeOf(open.session)
  const near = nearOf(view, route, hiddenBy(route, folded))
  const go = (id: string) =>
    setOpen((was) => (was === undefined ? was : { ...was, session: stepTo(was.session, id) }))
  // n and p step past folded calls, to the next or previous stop shown; off either end, as
  // the session moves. `target`, for into, is the call to step into; else the first not visited
  const move = (to: Move, target?: string) => {
    const past = to === "next" ? near.next : to === "previous" ? near.previous : undefined
    const stop = past === undefined ? undefined : route[past]
    if (stop !== undefined && view.kind === "step") {
      go(stop.id)
      return
    }

    setOpen((was) =>
      was === undefined ? was : { ...was, session: MOVES[to](was.session, target) },
    )
  }
  const fold = (id: string, on: boolean) =>
    setFolded((was) => new Set(on ? [...was, id] : [...was].filter((each) => each !== id)))
  const dirOf = (repo: string) => open.context.roots.get(repo)
  return {
    kind: "open",
    view,
    move,
    go,
    route,
    near,
    folded,
    fold,
    dirOf,
    changeAt: (step) => changeOf(open.session, dirOf(step.repo) ?? root, step.repo, step.file),
  }
}
