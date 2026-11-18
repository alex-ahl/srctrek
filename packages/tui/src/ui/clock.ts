import { useEffect, useState } from "react"

// Often enough that "today" turns into "yesterday" at midnight on a screen left open.
const TICK_MS = 60_000

/** The time now, taken again every minute; `fixed`, when given, as tests give it, instead. */
export function useNow(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date())

  useEffect(() => {
    if (fixed !== undefined) {
      return undefined
    }

    const timer = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(timer)
  }, [fixed])

  return now
}
