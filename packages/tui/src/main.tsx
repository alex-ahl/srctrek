import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { openInNeovim } from "./neovim"
import { loadTourEntries } from "./tour-list"

const entries = await loadTourEntries(process.cwd())
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
