import type { RGBA } from "@opentui/core"
import { useRenderer } from "@opentui/react"
import type { Settings } from "@srctrek/core"
import { useEffect, useState } from "react"
import { TERMINAL_TONES, type TerminalColours, type Tones, bandFor, tonesFor } from "../../ui/theme"

/**
 * The selected row's band and the states' tones, from the terminal's own colours when it says
 * what they are; a terminal that doesn't answer, or colours set to the terminal's, keeps its ANSI
 * colours and the marker in place of the band.
 */
export function useTerminalTones(
  colours: Settings["colours"],
): Readonly<{ tint: RGBA | undefined; tones: Tones }> {
  const renderer = useRenderer()
  // the background the terminal reported, which the band and srctrek's tones are chosen for
  const [reported, setReported] = useState<TerminalColours | undefined>(undefined)

  useEffect(() => {
    const asked = renderer.getPalette({ timeout: 1000 })
    void asked.then(
      ({ defaultForeground, defaultBackground }) => {
        if (defaultForeground !== null && defaultBackground !== null) {
          setReported({ foreground: defaultForeground, background: defaultBackground })
        }
      },
      () => undefined,
    )
  }, [renderer])

  const tint = reported === undefined ? undefined : bandFor(reported.background)
  const ownColours = reported !== undefined && colours !== "terminal"

  return { tint, tones: ownColours ? tonesFor(reported) : TERMINAL_TONES }
}
