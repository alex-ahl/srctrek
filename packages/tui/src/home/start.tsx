import {
  type ChangeChoice,
  type ChangeSummary,
  type ProposedRepo,
  type Settings,
  type TrekEntry,
  type TrekStatus,
  acceptProposal,
  buildFiles,
  dismissProposal,
  loadProposals,
  loadTrekEntries,
} from "@srctrek/core"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useState } from "react"
import { App } from "./screen"
import { type Editor, availableEditors, openInEditor } from "../editors/editors"
import { type FollowChange, useFollow } from "./watch/follow"
import type { Opening } from "./opening-line"
import { openInPager } from "../editors/pager"
import { TonesContext } from "../ui/theme"
import { useBuildWatch } from "./watch/use-build-watch"
import { useChoosing } from "./use-choosing"
import { useSettings } from "./watch/use-settings"
import { useTerminalTones } from "./watch/use-terminal-tones"
import { useTrekStates } from "./watch/use-trek-states"

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

// What trek is about when nothing else was chosen.
const OWN_BRANCH: ChangeChoice = { kind: "own", uncommitted: false }

type HomeProps = {
  root: string
  firstChange: HomeChange | undefined
  firstChoice: ChangeChoice
  follow: FollowChange | undefined
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
  const { root, onOpen, onQuit, onShowFile } = props
  const [change, setChange] = useState(props.firstChange)
  const [choice, setChoice] = useState(props.firstChoice)
  const [entries, setEntries] = useState(props.firstEntries)
  const [status, setStatus] = useState(props.firstStatus)
  const [proposals, setProposals] = useState(props.firstProposals)
  const [opening, setOpening] = useState<Opening | undefined>(undefined)
  const { settings, changeSetting } = useSettings(props.firstSettings)
  const { tint, tones } = useTerminalTones(settings.colours)
  const states = useTrekStates(root, entries)
  const editor = props.editors.find((each) => each.id === settings.editor)

  const reloadLists = async () => {
    setEntries(await loadTrekEntries(root))
    setProposals(await loadProposals(root))
  }

  // A change worked out anew: the list, proposals, and where its trek stands come with it.
  const show = async (next: HomeChange) => {
    setChange(next)
    await reloadLists()
    setStatus(await next.status())
  }

  // The worktree moves on while trek is open: a commit, a branch switched, a trek saved elsewhere.
  useFollow(props.follow, choice, show)
  useBuildWatch(status, change, { status: setStatus, ended: reloadLists })
  const choosing = useChoosing(root, props.follow, choice, {
    onOpening: (picked) => setOpening({ kind: "opening", choice: picked }),
    onPicked: (picked, next) => {
      setOpening(undefined)
      setChoice(picked)
      void show(next)
    },
    onFailed: (picked, why) => setOpening({ kind: "failed", choice: picked, why }),
  })

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
        choosing={choosing}
        opening={opening}
        states={states}
        tint={tint}
      />
    </TonesContext.Provider>
  )
}

/**
 * The home screen: the treks saved under `root`, each opened in the chosen editor on enter, and
 * where the change's trek stands, kept up with the worktree through `follow`.
 */
export async function startHome(
  root: string,
  change?: HomeChange,
  settings: Settings = {},
  follow?: FollowChange,
): Promise<void> {
  const firstEntries = await loadTrekEntries(root)
  const firstStatus = await change?.status()
  const firstProposals = await loadProposals(root)
  const editors = availableEditors()
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  createRoot(renderer).render(
    <Home
      root={root}
      firstChange={change}
      firstChoice={follow?.choice ?? OWN_BRANCH}
      follow={follow}
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
