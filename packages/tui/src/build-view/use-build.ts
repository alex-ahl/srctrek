import { useEffect, useState } from "react"
import type { BuildRead } from "./read"

// Often enough that a step added or a file read shows while the user watches.
const READ_MS = 1000

/** The build read now, and every second while the view is open; the time it was read at. */
export function useBuild(read: () => Promise<BuildRead>): {
  build: BuildRead | undefined
  now: Date
} {
  const [build, setBuild] = useState<BuildRead | undefined>(undefined)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let open = true
    const look = () =>
      void read().then(
        (next) => {
          if (open) {
            setBuild(next)
            setNow(new Date())
          }
        },
        () => undefined,
      )

    look()
    const timer = setInterval(look, READ_MS)
    return () => {
      open = false
      clearInterval(timer)
    }
  }, [read])

  return { build, now }
}
