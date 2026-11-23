import type { ChangeChoice, TrekStatus } from "@srctrek/core"
import { useRef, useState } from "react"
import type { OpenChange } from "./change/open-change"
import type { Pending } from "./opening"

/** A change open, and where its trek last stood. */
export type ChangeOpen = Readonly<{
  kind: "change"
  choice: ChangeChoice
  change: OpenChange
  status: TrekStatus
}>

/** A screen open: the one in front drawn, those under it gone back to in turn. */
export type Screen =
  | Readonly<{ kind: "landing" }>
  | Readonly<{ kind: "pending"; pending: Pending }>
  | ChangeOpen
  // a trek whose change is gone, on a change's screen with just the trek
  | Readonly<{ kind: "done"; name: string; why: string }>
  | Readonly<{ kind: "stepping"; name: string }>
  | Readonly<{ kind: "builds"; name: string; change: OpenChange | undefined }>
  | Readonly<{ kind: "settings" }>

/** A screen on the stack, by the id it keeps while it's there, whatever it's replaced with. */
export type Stacked = Screen & Readonly<{ id: number }>

const LANDING: Screen = { kind: "landing" }

/**
 * The screens open, front last: opened in front, gone back from, the front one replaced, and one
 * changed in its place, each by its id.
 */
export function useStack(first: Screen) {
  const ids = useRef(1)
  const [stack, setStack] = useState<readonly Stacked[]>(() => [{ ...first, id: 0 }])
  const next = () => {
    ids.current += 1
    return ids.current
  }

  // Every screen listening sees a key as it's pressed, the one that comes to the front too:
  // a key that opens or leaves a screen changes the stack once it's done with, so the screen it
  // brings up doesn't take that key as well (q leaving stepping, then the change it went back to).
  const afterKey = (change: (now: readonly Stacked[]) => readonly Stacked[]) =>
    setTimeout(() => setStack(change), 0)

  // the id of what's opened, for work that finishes later to find it
  const open = (screen: Screen): number => {
    const id = next()
    afterKey((now) => [...now, { ...screen, id }])
    return id
  }

  // back from the front screen; from the last one, to the landing page
  const back = () =>
    afterKey((now) => (now.length > 1 ? now.slice(0, -1) : [{ ...LANDING, id: next() }]))

  // the screen `id` is now `screen`, unless the user has gone back from it meanwhile; after the
  // key, too, so it never comes before the screen it replaces is opened
  const replace = (id: number, screen: Screen) =>
    afterKey((now) => now.map((each) => (each.id === id ? { ...screen, id } : each)))

  // the change `id` as `changed` leaves it, while it's still open
  const update = (id: number, changed: (was: ChangeOpen) => ChangeOpen) =>
    afterKey((now) =>
      now.map((each) =>
        each.id === id && each.kind === "change" ? { ...changed(each), id } : each,
      ),
    )

  return { stack, open, back, replace, update }
}
