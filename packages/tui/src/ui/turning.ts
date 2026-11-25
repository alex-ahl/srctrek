import { useEffect, useState } from "react"
import type { StateLabel } from "./state-labels"

// The busy symbol a quarter turn at a time, so a build shows it's going.
const FRAMES = ["◐", "◓", "◑", "◒"]
const FRAME_MS = 150

/** The busy symbol as it turns, a quarter at a time while `on`. */
export function useTurning(on = true): string {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!on) {
      return undefined
    }

    const timer = setInterval(() => setFrame((at) => (at + 1) % FRAMES.length), FRAME_MS)
    return () => clearInterval(timer)
  }, [on])

  return FRAMES[frame] ?? "◐"
}

/** A state as "symbol state", its symbol turning while the state is busy, such as building. */
export function useStateText(label: StateLabel | undefined): string {
  const busy = label?.tone === "busy"
  const turning = useTurning(busy)

  if (label === undefined) {
    return ""
  }

  return `${busy ? turning : label.symbol} ${label.state}`
}
