import type { OverviewView } from "@srctrek/core"
import { useEffect, useState } from "react"

/**
 * The overview of the trek saved as `name`, as `read` reads it: `first`, read before the screen opened, then read again
 * when `generation` moves on, as the trek may have been saved again; none while `shown` is false,
 * or unread.
 */
export function useOverview(
  read: (name: string) => Promise<OverviewView | undefined>,
  name: string,
  shown: boolean,
  generation: number,
  first: OverviewView | undefined,
): OverviewView | undefined {
  // kept with the trek it's of, so another trek's never shows while this one's read
  const [shownView, setShown] = useState<
    { name: string; view: OverviewView | undefined } | undefined
  >(() => (first === undefined ? undefined : { name, view: first }))

  useEffect(() => {
    if (!shown) {
      return undefined
    }

    let current = true
    const settle = (view: OverviewView | undefined) => current && setShown({ name, view })
    read(name).then(settle, () => settle(undefined))
    return () => {
      current = false
    }
    // a new generation reads the trek again, though nothing in the effect reads it
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [read, name, shown, generation])

  return shown && shownView?.name === name ? shownView.view : undefined
}
