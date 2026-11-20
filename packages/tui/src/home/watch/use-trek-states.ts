import { type TrekEntry, type TrekState, trekStates } from "@srctrek/core"
import { useEffect, useState } from "react"

/**
 * Where each saved trek stands against its branches now, by name, starting from `first`. Each
 * takes git calls, so a changed list is drawn first and its states fill in.
 */
export function useTrekStates(
  root: string,
  entries: readonly TrekEntry[],
  first: ReadonlyMap<string, TrekState>,
): ReadonlyMap<string, TrekState> {
  const [states, setStates] = useState(first)
  // `first` was worked out for the entries trek opened with, so only a later list is checked
  const [checked, setChecked] = useState(entries)

  useEffect(() => {
    let current = true
    if (entries !== checked) {
      void trekStates(root, [...entries]).then((found) => {
        if (current) {
          setStates(found)
          setChecked(entries)
        }
      })
    }

    return () => {
      current = false
    }
  }, [root, entries, checked])

  return states
}
