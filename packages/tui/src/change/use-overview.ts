import {
  type OverviewView,
  loadTrek,
  openSession,
  sessionView,
  trekPath,
  viewContext,
} from "@srctrek/core"
import { useEffect, useState } from "react"

// The view before a trek's first stop, for the trek saved as `name` under `root`.
async function overviewOf(root: string, name: string): Promise<OverviewView | undefined> {
  const trek = await loadTrek(trekPath(root, name))
  const view = sessionView(openSession(trek), await viewContext(root, trek))
  return view.kind === "overview" ? view : undefined
}

/**
 * The overview of the trek saved as `name`, once read, and read again when `generation` moves on,
 * as the trek may have been saved again; none while `shown` is false, or unread.
 */
export function useOverview(
  root: string,
  name: string,
  shown: boolean,
  generation: number,
): OverviewView | undefined {
  // kept with the trek it's of, so another trek's never shows while this one's read
  const [read, setRead] = useState<{ name: string; view: OverviewView | undefined }>()

  useEffect(() => {
    if (!shown) {
      return undefined
    }

    let current = true
    const settle = (view: OverviewView | undefined) => current && setRead({ name, view })
    overviewOf(root, name).then(settle, () => settle(undefined))
    return () => {
      current = false
    }
    // a new generation reads the trek again, though nothing in the effect reads it
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [root, name, shown, generation])

  return shown && read?.name === name ? read.view : undefined
}
