import {
  type ChangeSummary,
  type ProposedRepo,
  type TrekEntry,
  type TrekState,
  type TrekStatus,
  acceptProposal,
  buildFiles,
  dismissProposal,
  loadProposals,
  loadTrekEntries,
  trekStates,
} from "@srctrek/core"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useEffect, useState } from "react"
import { App } from "./app"
import { openInNeovim } from "./neovim"
import { openInPager } from "./pager"

/** What the home screen needs for the change trek was started for. */
export type HomeChange = {
  // what the change is, for the title bar
  summary: ChangeSummary
  status: () => Promise<TrekStatus>
  // starts building the change's trek; absent when no agent is set
  build?: (() => Promise<void>) | undefined
  // starts building the trek of a trigger found in the code; absent when no agent is set
  buildTrigger?: ((trigger: string) => Promise<void>) | undefined
}

// Something is being built: the change's trek, or the trek of one of its triggers.
function isBuilding(status: TrekStatus | undefined): boolean {
  if (status?.kind === "triggers") {
    return status.triggers.some(({ trek }) => trek.kind === "building")
  }

  return status?.kind === "building"
}

// A build takes minutes, so checking every couple of seconds is plenty.
const POLL_MS = 2000

type HomeProps = {
  root: string
  change: HomeChange | undefined
  firstEntries: TrekEntry[]
  firstStatus: TrekStatus | undefined
  firstProposals: ProposedRepo[]
  onOpen: (entry: TrekEntry) => void
  onQuit: () => void
  onShowFile: (path: string) => void
}

function Home(props: HomeProps) {
  const { root, change, onOpen, onQuit, onShowFile } = props
  const [entries, setEntries] = useState(props.firstEntries)
  const [status, setStatus] = useState(props.firstStatus)
  const [proposals, setProposals] = useState(props.firstProposals)
  const [states, setStates] = useState<ReadonlyMap<string, TrekState>>(new Map())

  // Each trek's state takes git calls, so the list is drawn first and the states fill in.
  useEffect(() => {
    let current = true
    void trekStates(root, entries).then((found) => current && setStates(found))

    return () => {
      current = false
    }
  }, [root, entries])

  // While the agent builds, check on it; when it ends, the trek list has changed too.
  const building = isBuilding(status)
  useEffect(() => {
    if (!building || change === undefined) {
      return undefined
    }

    const refresh = async () => {
      const next = await change.status()
      if (next.kind !== "building") {
        setEntries(await loadTrekEntries(root))
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
      summary={change?.summary}
      states={states}
    />
  )
}

/**
 * The home screen: the treks saved under `root`, each opened in Neovim on enter, and where
 * the trek of the change trek was started for stands.
 */
export async function startHome(root: string, change?: HomeChange): Promise<void> {
  const firstEntries = await loadTrekEntries(root)
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
