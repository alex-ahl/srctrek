import { type ChangeChoice, choiceArguments } from "@srctrek/core"
import { useEffect, useRef } from "react"
import type { OpenChange } from "../../change/open-change"

/**
 * How the home screen keeps up with the worktree: the change chosen as trek started, what's moved
 * it since, and the change a choice's arguments make as it stands now.
 */
export type FollowChange = Readonly<{
  choice: ChangeChoice
  // changes whenever the choice's change might have: a commit or a branch switched, here or in a
  // ticked repo, a trek saved, the agent
  stamp: (choice: ChangeChoice) => Promise<string>
  open: (args: string[]) => Promise<OpenChange>
}>

// Often enough that a commit or a trek saved elsewhere shows up while the user looks.
const FOLLOW_MS = 2000

/**
 * Checks the stamp every couple of seconds and, when it's moved, reopens the chosen change and
 * hands it to `onMoved`. A change that can't be worked out now keeps the last one until the stamp
 * moves again, rather than retrying on every check. A new choice was opened as it was picked, so
 * its first stamp is only taken, not compared.
 */
export function useFollow(
  follow: FollowChange | undefined,
  choice: ChangeChoice,
  onMoved: (change: OpenChange) => Promise<void>,
) {
  // the choice when the check runs, not when it was set up
  const chosen = useRef(choice)
  chosen.current = choice

  useEffect(() => {
    if (follow === undefined) {
      return undefined
    }

    let last: { choice: ChangeChoice; stamp: string } | undefined
    let checking = false
    const check = async () => {
      if (checking) {
        return
      }

      checking = true
      try {
        const now = chosen.current
        const stamp = await follow.stamp(now)
        const moved = last?.choice === now && last.stamp !== stamp
        last = { choice: now, stamp }
        if (moved) {
          await onMoved(await follow.open(choiceArguments(now)))
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
