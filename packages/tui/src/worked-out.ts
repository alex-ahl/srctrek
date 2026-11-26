import type { ChangeChoice } from "@srctrek/core"
import { useRef } from "react"
import type { Screen } from "./stack"

/** The key a choice is worked out by, the same for the same change. */
export const preparedKey = (choice: ChangeChoice) => JSON.stringify(choice)

/** A change listed, and for a pull request the commit its head is at, as listed. */
export type Listed = Readonly<{ choice: ChangeChoice; head?: string | undefined }>

// A change kept: its screen as it's worked out, and the pull request head it was worked out at.
type Kept = Readonly<{ screen: Promise<Screen>; head: string | undefined }>

/**
 * Changes worked out ahead, each once, by `prepare`, and kept until forgotten: those that couldn't
 * be opened aren't kept, to be tried again. The listed ones are worked out in the background, one
 * at a time, so moving to one finds it ready. A pull request is kept while its head stays where it
 * was worked out, the worktree moving on or not.
 */
export function useWorkedOut(prepare: (choice: ChangeChoice) => Promise<Screen>) {
  const worked = useRef(new Map<string, Kept>())
  // the changes listed, and those of them still to work out
  const listed = useRef<readonly Listed[]>([])
  const queue = useRef<readonly ChangeChoice[]>([])
  const draining = useRef(false)

  const drop = (key: string) => worked.current.delete(key)

  // where a listed pull request's head is, for what's worked out to be kept by it
  const headOf = (key: string) =>
    listed.current.find((each) => preparedKey(each.choice) === key)?.head

  const prepared = (choice: ChangeChoice): Promise<Screen> => {
    const key = preparedKey(choice)
    const known = worked.current.get(key)
    if (known !== undefined) {
      return known.screen
    }

    const screen = prepare(choice).then((found) => {
      // one that couldn't open is tried again next time, unless it's been forgotten meanwhile
      if (found.kind === "pending" && worked.current.get(key)?.screen === screen) {
        drop(key)
      }

      return found
    })
    worked.current.set(key, { screen, head: headOf(key) })
    return screen
  }

  // the next change in line, taken off the queue; none once it's empty
  const takeNext = () => {
    const [next, ...rest] = queue.current
    queue.current = rest
    return next
  }

  const drain = async () => {
    if (draining.current) {
      return
    }

    draining.current = true
    for (let next = takeNext(); next !== undefined; next = takeNext()) {
      await prepared(next)
    }

    draining.current = false
  }

  // what's listed, worked out from the first, what's kept skipped
  const workOutListed = () => {
    queue.current = listed.current.map((each) => each.choice)
    void drain()
  }

  return {
    prepared,
    // whether the change by this key is kept, worked out or under way
    kept: (key: string) => worked.current.has(key),
    drop,
    // the change by this key as it now stands, where it's kept
    update: (key: string, screen: Screen) => {
      const known = worked.current.get(key)
      if (known !== undefined) {
        worked.current.set(key, { ...known, screen: Promise.resolve(screen) })
      }
    },
    // the changes listed, to work out in the background, in their order; a pull request whose
    // head has moved since it was worked out, again
    ahead: (changes: readonly Listed[]) => {
      listed.current = changes
      for (const { choice, head } of changes) {
        const key = preparedKey(choice)
        const known = worked.current.get(key)
        if (known !== undefined && known.head !== head) {
          drop(key)
        }
      }

      workOutListed()
    },
    // out of date as the worktree moves on: what's listed is worked out again, but for the pull
    // requests, which it doesn't move
    forget: () => {
      worked.current = new Map([...worked.current].filter(([, known]) => known.head !== undefined))
      workOutListed()
    },
  }
}
