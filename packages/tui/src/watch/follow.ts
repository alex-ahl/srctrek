import type { ChangeChoice } from "@srctrek/core"
import { useEffect, useRef } from "react"

/**
 * Changes whenever a choice's change might have: a commit or a branch switched, here or in a
 * ticked repo, a trek saved, the agent.
 */
export type Stamp = (choice: ChangeChoice) => Promise<string>

// Often enough that a commit or a trek saved elsewhere shows up while the user looks.
const FOLLOW_MS = 2000

/**
 * Checks the choice's stamp every couple of seconds and, when it's moved, tells `onMoved`. A move
 * `onMoved` can't take in now is left until the stamp moves again, rather than retried on every
 * check. A new choice was opened as it was picked, so its first stamp is only taken, not compared.
 */
export function useFollow(stamp: Stamp, choice: ChangeChoice, onMoved: () => Promise<void>) {
  // the choice, and what a move does, when the check runs, not when it was set up
  const chosen = useRef(choice)
  const moves = useRef(onMoved)
  useEffect(() => {
    chosen.current = choice
    moves.current = onMoved
  })

  useEffect(() => {
    let last: { choice: ChangeChoice; stamp: string } | undefined
    let checking = false
    const check = async () => {
      if (checking) {
        return
      }

      checking = true
      try {
        const now = chosen.current
        const stamped = await stamp(now)
        const moved = last?.choice === now && last.stamp !== stamped
        last = { choice: now, stamp: stamped }
        if (moved) {
          await moves.current()
        }
      } catch {
        // kept: what's shown, as last worked out
      } finally {
        checking = false
      }
    }

    void check()
    const timer = setInterval(() => void check(), FOLLOW_MS)

    return () => clearInterval(timer)
  }, [stamp])
}
