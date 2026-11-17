import { useEffect, useState } from "react"
import type { StateLabel } from "./state-labels"

// The busy symbol a quarter turn at a time, so a build shows it's going.
const FRAMES = ["◐", "◓", "◑", "◒"]
const FRAME_MS = 150

/** A state as "symbol state", its symbol turning while the state is busy, such as building. */
export function useStateText(label: StateLabel | undefined): string {
  const busy = label?.tone === "busy"
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!busy) {
      return undefined
    }

    const timer = setInterval(() => setFrame((at) => (at + 1) % FRAMES.length), FRAME_MS)
    return () => clearInterval(timer)
  }, [busy])

  if (label === undefined) {
    return ""
  }

  return `${busy ? FRAMES[frame] : label.symbol} ${label.state}`
}
