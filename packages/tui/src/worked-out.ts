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
  const working = useRef(new Map<string, Promise<Screen>>())
  const done = useRef(new Map<string, Screen>())
  // the changes listed, and those of them still to work out
  const listed = useRef<readonly ChangeChoice[]>([])
  const queue = useRef<readonly ChangeChoice[]>([])
  const draining = useRef(false)

  const drop = (key: string) => {
    working.current.delete(key)
    done.current.delete(key)
  }

  const prepared = (choice: ChangeChoice): Promise<Screen> => {
    const key = preparedKey(choice)
    const known = working.current.get(key)
    if (known !== undefined) {
      return known
    }

    const screen = prepare(choice).then((worked) => {
      // forgotten meanwhile, it's out of date
      if (working.current.get(key) === screen) {
        if (worked.kind === "pending") {
          drop(key)
        } else {
          done.current.set(key, worked)
        }
      }

      return worked
    })
    working.current.set(key, screen)
    return screen
  }

  const drain = async () => {
    if (draining.current) {
      return
    }

    draining.current = true
    for (let next = queue.current[0]; next !== undefined; next = queue.current[0]) {
      queue.current = queue.current.slice(1)
      await prepared(next)
    }

    draining.current = false
  }

  return {
    prepared,
    // the change by this key, once it's worked out
    ready: (key: string) => done.current.get(key),
    drop,
    // the change by this key as it now stands, where it's kept
    update: (key: string, screen: Screen) => {
      if (done.current.has(key)) {
        done.current.set(key, screen)
        working.current.set(key, Promise.resolve(screen))
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
      working.current = new Map()
      done.current = new Map()
      queue.current = listed.current
      void drain()
    },
  }
}
