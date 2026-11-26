import type { ChangeChoice } from "@srctrek/core"
import { useRef } from "react"
import type { Screen } from "./stack"

/** The key a choice is worked out by, the same for the same change. */
export const preparedKey = (choice: ChangeChoice) => JSON.stringify(choice)

/**
 * Changes worked out ahead, each once, by `prepare`, and kept until forgotten: those that couldn't
 * be opened aren't kept, to be tried again. The listed ones are worked out in the background, one
 * at a time, so moving to one finds it ready.
 */
export function useWorkedOut(prepare: (choice: ChangeChoice) => Promise<Screen>) {
  const worked = useRef(new Map<string, Promise<Screen>>())
  // the changes listed, and those of them still to work out
  const listed = useRef<readonly ChangeChoice[]>([])
  const queue = useRef<readonly ChangeChoice[]>([])
  const draining = useRef(false)

  const drop = (key: string) => worked.current.delete(key)

  const prepared = (choice: ChangeChoice): Promise<Screen> => {
    const key = preparedKey(choice)
    const known = worked.current.get(key)
    if (known !== undefined) {
      return known
    }

    const screen = prepare(choice).then((found) => {
      // one that couldn't open is tried again next time, unless it's been forgotten meanwhile
      if (found.kind === "pending" && worked.current.get(key) === screen) {
        drop(key)
      }

      return found
    })
    worked.current.set(key, screen)
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

  return {
    prepared,
    // whether the change by this key is kept, worked out or under way
    kept: (key: string) => worked.current.has(key),
    drop,
    // the change by this key as it now stands, where it's kept
    update: (key: string, screen: Screen) => {
      if (worked.current.has(key)) {
        worked.current.set(key, Promise.resolve(screen))
      }
    },
    // the changes listed, to work out in the background, in their order
    ahead: (choices: readonly ChangeChoice[]) => {
      listed.current = choices
      queue.current = choices
      void drain()
    },
    // out of date: the changes listed are worked out again
    forget: () => {
      worked.current = new Map()
      queue.current = listed.current
      void drain()
    },
  }
}
