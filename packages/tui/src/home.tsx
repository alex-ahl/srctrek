import {
  type ProposedRepo,
  type TourEntry,
  type TourStatus,
  acceptProposal,
  buildFiles,
  dismissProposal,
  loadProposals,
  loadTourEntries,
} from "@srctrek/core"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useEffect, useState } from "react"
import { App } from "./app"
import { openInNeovim } from "./neovim"
import { openInPager } from "./pager"

/** What the home screen needs for the change trek was started for. */
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
  firstProposals: ProposedRepo[]
  onOpen: (entry: TourEntry) => void
  onQuit: () => void
  onShowFile: (path: string) => void
}

function Home(props: HomeProps) {
  const { root, change, onOpen, onQuit, onShowFile } = props
  const [entries, setEntries] = useState(props.firstEntries)
  const [status, setStatus] = useState(props.firstStatus)
  const [proposals, setProposals] = useState(props.firstProposals)

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
        setProposals(await loadProposals(root))
      }

      setStatus(next)
    }
    const timer = setInterval(() => void refresh(), POLL_MS)

    return () => clearInterval(timer)
  }, [building, change, root])

  const showLog = async (name: string) => onShowFile((await buildFiles(root, name)).log)

  // Adding or dismissing a proposed repo settles it, so it leaves the list.
  const settle = async (settling: Promise<void>) => {
    await settling
    setProposals(await loadProposals(root))
  }

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
      proposals={proposals}
      onAddRepo={(name, location) => void settle(acceptProposal(root, name, location))}
      onDismissRepo={(name) => void settle(dismissProposal(root, name))}
    />
  )
}

/**
 * The home screen: the tours saved under `root`, each opened in Neovim on enter, and where
 * the tour of the change trek was started for stands.
 */
export async function startHome(root: string, change?: HomeChange): Promise<void> {
  const firstEntries = await loadTourEntries(root)
  const firstStatus = await change?.status()
  const firstProposals = await loadProposals(root)
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  createRoot(renderer).render(
    <Home
      root={root}
      change={change}
      firstEntries={firstEntries}
      firstStatus={firstStatus}
      firstProposals={firstProposals}
      onOpen={(entry) => void openInNeovim(renderer, entry.name)}
      onShowFile={(path) => void openInPager(renderer, path)}
      onQuit={() => {
        renderer.destroy()
        process.exit(0)
      }}
    />,
  )
}
