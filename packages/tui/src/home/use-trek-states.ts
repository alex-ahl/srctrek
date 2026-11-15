import { type TrekEntry, type TrekState, trekStates } from "@srctrek/core"
import { useEffect, useState } from "react"

/**
 * Where each saved trek stands against its branches now, by name. Each takes git calls, so the
 * list is drawn first and the states fill in.
 */
export function useTrekStates(
  root: string,
  entries: readonly TrekEntry[],
): ReadonlyMap<string, TrekState> {
  const [states, setStates] = useState<ReadonlyMap<string, TrekState>>(new Map())

  useEffect(() => {
    let current = true
    void trekStates(root, [...entries]).then((found) => current && setStates(found))

    return () => {
      current = false
    }
  }, [root, entries])

  return states
}
