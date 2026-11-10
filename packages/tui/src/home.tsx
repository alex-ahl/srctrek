import {
  type ChangeSummary,
  type ProposedRepo,
  type Settings,
  type TrekEntry,
  type TrekState,
  type TrekStatus,
  acceptProposal,
  buildFiles,
  dismissProposal,
  loadProposals,
  loadSettings,
  loadTrekEntries,
  saveSetting,
  trekStates,
} from "@srctrek/core"
import { createCliRenderer } from "@opentui/core"
import { createRoot, useRenderer } from "@opentui/react"
import { useEffect, useState } from "react"
import { App } from "./app"
import { type Editor, availableEditors, openInEditor } from "./editors"
import { openInPager } from "./pager"
import type { SettingChange } from "./settings-screen"
import { TERMINAL_TONES, type TerminalColours, TonesContext, bandFor, tonesFor } from "./theme"

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

// Often enough that an agent's save shows up while the user waits for it.
const SETTINGS_POLL_MS = 2000

// A build takes minutes, so checking every couple of seconds is plenty.
const POLL_MS = 2000

type HomeProps = {
  root: string
  change: HomeChange | undefined
  firstEntries: TrekEntry[]
  firstStatus: TrekStatus | undefined
  firstProposals: ProposedRepo[]
  // the editors treks can open in here, and the user's settings as trek started
  editors: readonly Editor[]
  firstSettings: Settings
  onOpen: (entry: TrekEntry, editor: Editor) => void
  onQuit: () => void
  onShowFile: (path: string) => void
}

function Home(props: HomeProps) {
  const { root, change, onOpen, onQuit, onShowFile } = props
  const [settings, setSettings] = useState(props.firstSettings)
  const editor = props.editors.find((each) => each.id === settings.editor)

  // The settings file can change while trek runs: the agent saves its command from its chat, or
  // the user edits it. A file broken meanwhile keeps what was read before.
  useEffect(() => {
    const reread = async () => {
      const now = await loadSettings().catch(() => undefined)
      if (now !== undefined) {
        setSettings((shown) => (JSON.stringify(shown) === JSON.stringify(now) ? shown : now))
      }
    }
    const timer = setInterval(() => void reread(), SETTINGS_POLL_MS)

    return () => clearInterval(timer)
  }, [])

  // A changed setting holds for every repo; a settings file broken meanwhile keeps the old one.
  const changeSetting: SettingChange = (key, value) => {
    setSettings({ ...settings, [key]: value })
    void saveSetting(key, value).catch(() => undefined)
  }
  const [entries, setEntries] = useState(props.firstEntries)
  const [status, setStatus] = useState(props.firstStatus)
  const [proposals, setProposals] = useState(props.firstProposals)
  const [states, setStates] = useState<ReadonlyMap<string, TrekState>>(new Map())
  // the background the terminal reported, which the band and srctrek's tones are chosen for
  const [reported, setReported] = useState<TerminalColours | undefined>(undefined)
  const tint = reported === undefined ? undefined : bandFor(reported.background)
  const ownColours = reported !== undefined && settings.colours !== "terminal"
  const tones = ownColours ? tonesFor(reported) : TERMINAL_TONES
  const renderer = useRenderer()

  // The selected row's tint and the states' tones come from the terminal's own colours, when it
  // says what they are; a terminal that doesn't answer keeps the marker and its ANSI colours.
  useEffect(() => {
    const colours = renderer.getPalette({ timeout: 1000 })
    void colours.then(
      ({ defaultForeground, defaultBackground }) => {
        if (defaultForeground !== null && defaultBackground !== null) {
          setReported({ foreground: defaultForeground, background: defaultBackground })
        }
      },
      () => undefined,
    )
  }, [renderer])

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
    <TonesContext.Provider value={tones}>
      <App
        entries={entries}
        onOpen={(entry) => editor !== undefined && onOpen(entry, editor)}
        editors={props.editors}
        editor={editor}
        onChooseEditor={(picked) => changeSetting("editor", picked.id)}
        settings={settings}
        onChangeSetting={changeSetting}
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
        tint={tint}
      />
    </TonesContext.Provider>
  )
}

/**
 * The home screen: the treks saved under `root`, each opened in Neovim on enter, and where
 * the trek of the change trek was started for stands.
 */
export async function startHome(
  root: string,
  change?: HomeChange,
  settings: Settings = {},
): Promise<void> {
  const firstEntries = await loadTrekEntries(root)
  const firstStatus = await change?.status()
  const firstProposals = await loadProposals(root)
  const editors = availableEditors()
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  createRoot(renderer).render(
    <Home
      root={root}
      change={change}
      firstEntries={firstEntries}
      firstStatus={firstStatus}
      firstProposals={firstProposals}
      editors={editors}
      firstSettings={settings}
      onOpen={(entry, editor) => void openInEditor(renderer, root, entry, editor)}
      onShowFile={(path) => void openInPager(renderer, path)}
      onQuit={() => {
        renderer.destroy()
        process.exit(0)
      }}
    />,
  )
}
