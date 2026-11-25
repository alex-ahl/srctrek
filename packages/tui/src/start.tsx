import type { Settings } from "@srctrek/core"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App, type Opening } from "./app"
import { availableEditors } from "./editors/editors"
import { type Ways, sourcesAt } from "./sources"

/**
 * trek's screens for the repo at `root`, opening on `opening`, with the user's settings as trek
 * started; changes are opened and followed `ways`.
 */
export async function startScreens(
  root: string,
  opening: Opening,
  settings: Settings,
  ways: Ways,
): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  createRoot(renderer).render(
    <App
      root={root}
      opening={opening}
      sources={sourcesAt(root, ways)}
      firstSettings={settings}
      editors={availableEditors()}
      onQuit={() => {
        renderer.destroy()
        process.exit(0)
      }}
    />,
  )
}
