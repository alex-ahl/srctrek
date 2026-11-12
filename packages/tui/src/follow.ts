import { useEffect } from "react"
import type { HomeChange } from "./home"

/** How the home screen keeps up with the worktree: what's moved it, and the change as it is now. */
export type FollowChange = Readonly<{
  // changes whenever the change might have: a commit, a branch switched, a trek saved, the agent
  stamp: () => Promise<string>
  reopen: () => Promise<HomeChange>
}>

// Often enough that a commit or a trek saved elsewhere shows up while the user looks.
const FOLLOW_MS = 2000

/**
 * Checks the stamp every couple of seconds and, when it's moved, reopens the change and hands it
 * to `onMoved`. A change that can't be worked out now keeps the last one until the stamp moves
 * again, rather than retrying on every check.
 */
export function useFollow(
  follow: FollowChange | undefined,
  onMoved: (change: HomeChange) => Promise<void>,
) {
  useEffect(() => {
    if (follow === undefined) {
      return undefined
    }

    let last: string | undefined
    let checking = false
    const check = async () => {
      if (checking) {
        return
      }

      checking = true
      try {
        const stamp = await follow.stamp()
        const moved = last !== undefined && stamp !== last
        last = stamp
        if (moved) {
          await onMoved(await follow.reopen())
        }
      } catch {
        // kept: the change as last worked out
      } finally {
        checking = false
      }
    }

    void check()
    const timer = setInterval(() => void check(), FOLLOW_MS)

    return () => clearInterval(timer)
    // onMoved is a fresh function each render; the check only needs the one it started with
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [follow])
}
