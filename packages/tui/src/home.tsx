import { type TourStatus, buildFiles } from "@codetrail/core"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useEffect, useState } from "react"
import { App } from "./app"
import { openInNeovim } from "./neovim"
import { openInPager } from "./pager"
import { type TourEntry, loadTourEntries } from "./tour-list"

/** What the home screen needs for the change trail was started for. */
export type HomeChange = {
  status: () => Promise<TourStatus>
  // starts building the change's tour; absent when no agent is set
  build?: (() => Promise<void>) | undefined
  // starts building the tour of a trigger found in the code; absent when no agent is set
  buildTrigger?: ((trigger: string) => Promise<void>) | undefined
}

// Something is being built: the change's tour, or the tour of one of its triggers.
function isBuilding(status: TourStatus | undefined): boolean {
  if (status?.kind === "triggers") {
    return status.triggers.some(({ tour }) => tour.kind === "building")
  }

  return status?.kind === "building"
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
  onShowFile: (path: string) => void
}

function Home({ root, change, firstEntries, firstStatus, onOpen, onQuit, onShowFile }: HomeProps) {
  const [entries, setEntries] = useState(firstEntries)
  const [status, setStatus] = useState(firstStatus)

  // While the agent builds, check on it; when it ends, the tour list has changed too.
  const building = isBuilding(status)
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

  const showLog = async (name: string) => onShowFile((await buildFiles(root, name)).log)

  // Starts a build, then shows it as building straight away rather than at the next check.
  const started = async (start: Promise<void>) => {
    await start
    setStatus(await change?.status())
  }
  const build = change?.build
  const buildTrigger = change?.buildTrigger

  return (
    <App
      entries={entries}
      onOpen={onOpen}
      onQuit={onQuit}
      status={status}
      onBuild={build === undefined ? undefined : () => void started(build())}
      onBuildTrigger={
        buildTrigger === undefined ? undefined : (trigger) => void started(buildTrigger(trigger))
      }
      onShowLog={(name) => void showLog(name)}
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
      onShowFile={(path) => void openInPager(renderer, path)}
      onQuit={() => {
        renderer.destroy()
        process.exit(0)
      }}
    />,
  )
}
