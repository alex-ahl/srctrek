import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { openInNeovim } from "./neovim"
import { loadTourEntries } from "./tour-list"

/** The home screen: the tours saved under `root`, each opened in Neovim on enter. */
export async function startHome(root: string): Promise<void> {
  const entries = await loadTourEntries(root)
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  createRoot(renderer).render(
    <App
      entries={entries}
      onOpen={(entry) => void openInNeovim(renderer, entry.path)}
      onQuit={() => {
        renderer.destroy()
        process.exit(0)
      }}
    />,
  )
}
