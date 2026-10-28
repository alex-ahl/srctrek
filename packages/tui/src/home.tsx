import type { TourStatus } from "@codetrail/core"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useEffect, useState } from "react"
import { App } from "./app"
import { openInNeovim } from "./neovim"
import { type TourEntry, loadTourEntries } from "./tour-list"

/** What the home screen needs for the change trail was started for. */
export type HomeChange = {
  status: () => Promise<TourStatus>
  // starts building the change's tour; absent when no agent is set
  build?: (() => Promise<void>) | undefined
}

// A build takes minutes, so checking every couple of seconds is plenty.
const POLL_MS = 2000

type HomeProps = {
  root: string
  change: HomeChange | undefined
  firstEntries: TourEntry[]
  firstStatus: TourStatus | undefined
  onOpen: (entry: TourEntry) => void
  onQuit: () => void
}

function Home({ root, change, firstEntries, firstStatus, onOpen, onQuit }: HomeProps) {
  const [entries, setEntries] = useState(firstEntries)
  const [status, setStatus] = useState(firstStatus)

  // While the agent builds, check on it; when it ends, the tour list has changed too.
  const building = status?.kind === "building"
  useEffect(() => {
    if (!building || change === undefined) {
      return undefined
    }

    const refresh = async () => {
      const next = await change.status()
      if (next.kind !== "building") {
        setEntries(await loadTourEntries(root))
      }

      setStatus(next)
    }
    const timer = setInterval(() => void refresh(), POLL_MS)

    return () => clearInterval(timer)
  }, [building, change, root])

  const build = change?.build
  const startBuild = async (start: () => Promise<void>) => {
    await start()
    setStatus(await change?.status())
  }

  return (
    <App
      entries={entries}
      onOpen={onOpen}
      onQuit={onQuit}
      status={status}
      onBuild={build === undefined ? undefined : () => void startBuild(build)}
    />
  )
}

/**
 * The home screen: the tours saved under `root`, each opened in Neovim on enter, and where
 * the tour of the change trail was started for stands.
 */
export async function startHome(root: string, change?: HomeChange): Promise<void> {
  const firstEntries = await loadTourEntries(root)
  const firstStatus = await change?.status()
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  createRoot(renderer).render(
    <Home
      root={root}
      change={change}
      firstEntries={firstEntries}
      firstStatus={firstStatus}
      onOpen={(entry) => void openInNeovim(renderer, entry.path)}
      onQuit={() => {
        renderer.destroy()
        process.exit(0)
      }}
    />,
  )
}
