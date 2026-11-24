import { type RepoBranches, type RepoPick, errorText } from "@srctrek/core"
import { useRef, useState } from "react"
import { stepped } from "../ui/move"
import { type Drop, type DropRow, dropRows, opened } from "./drop"

/** A key as the picker hands it on: its name, and the text it types, if any. */
export type DropKey = Readonly<{ name: string; sequence?: string; ctrl?: boolean; meta?: boolean }>

/** A letter, digit, or sign typed to narrow a list, not a key that does something. */
export const typed = (key: DropKey) =>
  key.ctrl !== true && key.meta !== true && key.sequence?.length === 1 && key.sequence >= " "

/**
 * A repo's branches open under its row: which repo, its branches once read, the lines they make,
 * and the keys while it's open. Taking a line hands its tick to `onTake` and closes it.
 */
export function useDrop(
  repoBranches: (path: string) => Promise<RepoBranches>,
  fetchRepo: (path: string) => Promise<void>,
  onTake: (pick: RepoPick) => void,
) {
  const [drop, setDropState] = useState<Drop | undefined>(undefined)
  // the drop as last set, ahead of the screen, for enter pressed right after a move
  const latest = useRef(drop)
  const setDrop = (next: Drop | undefined | ((now: Drop | undefined) => Drop | undefined)) =>
    setDropState((now) => {
      const value = typeof next === "function" ? next(now) : next
      latest.current = value
      return value
    })
  const [found, setFound] = useState<ReadonlyMap<string, RepoBranches>>(new Map())
  const [problem, setProblem] = useState<string | undefined>(undefined)

  const read = (path: string) =>
    repoBranches(path).then(
      (branches) => setFound((known) => new Map(known).set(path, branches)),
      (error: unknown) => setProblem(errorText(error)),
    )
  const open = (path: string) => {
    setDrop(opened(path))
    setProblem(undefined)
    if (!found.has(path)) {
      void read(path)
    }
  }

  const rowsOf = (shown: Drop | undefined) => {
    const branches = shown === undefined ? undefined : found.get(shown.path)
    return shown === undefined || branches === undefined ? undefined : dropRows(branches, shown)
  }
  const rows = rowsOf(drop)
  const rowAt = (shown: Drop | undefined) => rowsOf(shown)?.[shown?.at ?? 0]

  // from the drop as it is, so keys pressed faster than the screen redraws each count
  const update = (change: (now: Drop) => Partial<Drop>) =>
    setDrop((now) => (now === undefined ? now : { ...now, ...change(now) }))
  const set = (change: Partial<Drop>) => update(() => change)
  const fetch = (path: string) => {
    set({ fetch: { kind: "fetching" } })
    void fetchRepo(path)
      .then(() => read(path))
      .then(
        () => set({ fetch: undefined, all: true }),
        (error: unknown) => set({ fetch: { kind: "failed", why: errorText(error) } }),
      )
  }
  const take = (row: DropRow | undefined) => {
    if (row?.kind === "more") {
      set({ all: true })
    } else if (row?.kind === "fetch") {
      fetch(drop?.path ?? "")
    } else if (row !== undefined) {
      onTake(row.pick)
      setDrop(undefined)
    }
  }

  /** Handles a key while the drop is open; false when it's closed. */
  const key = (pressed: DropKey): boolean => {
    if (drop === undefined) {
      return false
    }

    const count = rows?.length ?? 0
    const actions = new Map([
      ["escape", () => setDrop(undefined)],
      ["left", () => setDrop(undefined)],
      ["down", () => update((now) => ({ at: stepped(now.at, 1, count) }))],
      ["up", () => update((now) => ({ at: stepped(now.at, -1, count) }))],
      ["return", () => take(rowAt(latest.current))],
      ["backspace", () => update((now) => ({ query: now.query.slice(0, -1), at: 0 }))],
    ])
    const action = actions.get(pressed.name)
    if (action !== undefined) {
      action()
    } else if (typed(pressed)) {
      update((now) => ({ query: now.query + (pressed.sequence ?? ""), at: 0 }))
    }

    return true
  }

  return { drop, rows, problem, open, key }
}
