import { useRenderer } from "@opentui/react"
import {
  type ChangeChoice,
  type Settings,
  type TrekEntry,
  type TrekStatus,
  choiceArguments,
} from "@srctrek/core"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { BuildScreen } from "./build-view/screen"
import type { ChangeActions } from "./change/keys"
import type { OpenChange } from "./change/open-change"
import { ChangeScreen } from "./change/screen"
import { WaysInScreen } from "./change/ways-in-screen"
import { type Editor, openInEditor } from "./editors/editors"
import type { Pick } from "./landing/rows"
import { Landing } from "./landing/screen"
import { PendingScreen, failureReason } from "./opening"
import { SettingsScreen } from "./settings/screen"
import type { Sources } from "./sources"
import { type ChangeOpen, type Screen, useStack } from "./stack"
import { changeInFront, useStanding } from "./standing"
import { SteppingScreen } from "./stepping/screen"
import { TonesContext } from "./ui/theme"
import { useFollow } from "./watch/follow"
import { useSettings } from "./watch/use-settings"
import { useTerminalTones } from "./watch/use-terminal-tones"

/** What trek opens on: the landing page, or the change its args name, already worked out. */
export type Opening = Readonly<{ kind: "landing" }> | ChangeOpen

type Props = {
  root: string
  opening: Opening
  sources: Sources
  firstSettings: Settings
  // the editors treks can be stepped in here
  editors: readonly Editor[]
  onQuit: () => void
}

const OWN: ChangeChoice = { kind: "own", uncommitted: false }

// A trek's title, once the saved treks are read; its name until then.
function titleOf(entries: readonly TrekEntry[], name: string): string {
  const entry = entries.find((each) => each.name === name)
  return entry?.valid === true ? entry.title : name
}

// Code as it is with no trigger: its ways in, once found, are its screen.
const findsWaysIn = (change: OpenChange) =>
  change.summary.code && change.summary.trigger === undefined

/**
 * trek's screens: the landing page, a change's screen, stepping a trek, its builds, and the
 * settings; each opened in front of the last and gone back from with esc or q. Where the change in
 * front stands is kept here, on the stack; while open, it follows the worktree, and the landing
 * page lists what's there now.
 */
export function App(props: Props) {
  const { root, sources, editors } = props
  const renderer = useRenderer()
  const { stack, open, back, replace, update } = useStack(props.opening)
  const front = stack.at(-1)
  const setStatus = (id: number, status: TrekStatus) => update(id, (was) => ({ ...was, status }))
  const { proposal, run, readProposals } = useStanding(changeInFront(front), sources, setStatus)
  // moves on as the worktree does, for what's shown to be read again
  const [generation, setGeneration] = useState(0)
  const [entries, setEntries] = useState<readonly TrekEntry[]>([])
  // what was opened from the landing page last, selected there again on the way back
  const [from, setFrom] = useState<Pick | undefined>(undefined)
  const { settings, changeSetting } = useSettings(props.firstSettings)
  const { tint, tones } = useTerminalTones(settings.colours)
  const chosenEditor = editors.find((each) => each.id === settings.step_in)

  useEffect(() => {
    void sources.entries().then(setEntries, () => undefined)
  }, [sources, generation])

  // the change nearest the front, reopened as the worktree moves on
  const following = stack.findLast((screen) => screen.kind === "change")
  useFollow(sources.stamp, following?.choice ?? OWN, async () => {
    if (following !== undefined) {
      const change = await sources.open(choiceArguments(following.choice))
      const status = await change.status()
      update(following.id, (was) => ({ ...was, change, status }))
      await readProposals()
    }

    setGeneration((was) => was + 1)
  })

  // A change picked or followed: worked out on a screen of its own, then shown in its place.
  const openChoice = (choice: ChangeChoice) => {
    const id = open({ kind: "pending", pending: { kind: "opening", choice } })
    const opening = async () => {
      const change = await sources.open(choiceArguments(choice))
      replace(id, { kind: "change", choice, change, status: await change.status() })
    }

    opening().catch((error: unknown) =>
      replace(id, {
        kind: "pending",
        pending: { kind: "failed", choice, why: failureReason(error) },
      }),
    )
  }

  const pick = (picked: Pick) => {
    setFrom(picked)
    if (picked.kind === "trek") {
      open({ kind: "done", name: picked.name, why: picked.why })
    } else {
      openChoice(picked)
    }
  }

  // The editor treks are stepped in: the one chosen, else the first found here.
  const editor = chosenEditor ?? editors[0]
  const changeActions = (change: OpenChange | undefined): ChangeActions => ({
    step: (name) => open({ kind: "stepping", name }),
    editor:
      editor === undefined
        ? undefined
        : {
            label: `${editor.steps ? "step" : "open"} in ${editor.label}`,
            open: (name) => {
              const entry = entries.find((each) => each.name === name)
              if (entry !== undefined) {
                void openInEditor(renderer, root, entry, editor)
              }
            },
          },
    editorFirst: chosenEditor !== undefined,
    build: change?.build,
    stop: sources.stopBuild,
    builds: (name) => open({ kind: "builds", name, change }),
    addRepo: sources.addRepo,
    dismissRepo: sources.dismissRepo,
    back,
  })
  const readLatest = useCallback((name: string) => sources.readBuild(name, 0), [sources])

  // the landing page's lists, asked again as the worktree moves on
  const landing = useMemo(
    () => ({
      load: () => sources.load(),
      pullRequests: () => sources.pullRequests(),
      nearby: () => sources.nearby(),
      done: () => sources.done(),
    }),
    // a new generation is a new set, for the page to ask again
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [sources, generation],
  )

  // A change's screen, or, for code as it is once its ways in are found, those.
  const changeScreen = ({ change, choice, status }: ChangeOpen): ReactNode => {
    if (findsWaysIn(change) && status.kind === "triggers") {
      const repos = choice.repos && { repos: choice.repos }
      return (
        <WaysInScreen
          summary={change.summary}
          ways={status.triggers}
          actions={{
            stepTrek: (name) => open({ kind: "stepping", name }),
            buildTrigger: change.buildTrigger ?? (() => Promise.resolve()),
            follow: (trigger) => openChoice({ kind: "code", trigger, ...repos }),
          }}
          find={change.build}
          run={run}
          back={back}
        />
      )
    }

    return (
      <ChangeScreen
        root={root}
        summary={change.summary}
        status={status}
        proposal={proposal}
        readBuild={readLatest}
        actions={changeActions(change)}
        run={run}
        generation={generation}
      />
    )
  }

  const screen = (shown: Screen): ReactNode => {
    if (shown.kind === "landing") {
      return (
        <Landing
          {...landing}
          repoBranches={sources.repoBranches}
          fetchRepo={sources.fetchRepo}
          status={sources.status}
          from={from}
          onPick={pick}
          onSettings={() => open({ kind: "settings" })}
          onQuit={props.onQuit}
          tint={tint}
        />
      )
    }

    if (shown.kind === "pending") {
      return <PendingScreen pending={shown.pending} onBack={back} />
    }

    if (shown.kind === "change") {
      return changeScreen(shown)
    }

    if (shown.kind === "done") {
      return (
        <ChangeScreen
          root={root}
          summary={undefined}
          status={{ kind: "ready", name: shown.name }}
          done={shown.why}
          proposal={undefined}
          readBuild={readLatest}
          actions={changeActions(undefined)}
          run={(work) => void work.catch(() => undefined)}
          generation={generation}
        />
      )
    }

    if (shown.kind === "stepping") {
      return (
        <SteppingScreen
          root={root}
          editor={chosenEditor?.command ?? process.env["EDITOR"]}
          name={shown.name}
          title={titleOf(entries, shown.name)}
          onBack={back}
          tint={tint}
        />
      )
    }

    if (shown.kind === "builds") {
      return (
        <Builds
          name={shown.name}
          title={titleOf(entries, shown.name)}
          change={shown.change}
          sources={sources}
          onBack={back}
        />
      )
    }

    return (
      <SettingsScreen
        settings={settings}
        editors={editors}
        editor={chosenEditor}
        onChange={changeSetting}
        onBack={back}
        tint={tint}
      />
    )
  }

  // keyed by the screen, so one opened in another's place starts afresh
  return (
    <TonesContext.Provider value={tones}>
      <box key={front?.id ?? 0} style={{ width: "100%", height: "100%" }}>
        {front === undefined ? undefined : screen(front)}
      </box>
    </TonesContext.Provider>
  )
}

// A trek's builds: stopped while one runs, and, for a change's trek, built again.
function Builds(props: {
  name: string
  title: string
  change: OpenChange | undefined
  sources: Sources
  onBack: () => void
}) {
  const { name, change, sources } = props
  const read = useCallback((back: number) => sources.readBuild(name, back), [sources, name])
  const summary = change?.summary
  const build = change?.build

  return (
    <BuildScreen
      summary={summary}
      name={props.title}
      findsWaysIn={summary?.code === true && summary.trigger === undefined}
      read={read}
      onStop={() => void sources.stopBuild(name)}
      onBuildAgain={build === undefined ? undefined : () => void build()}
      onBack={props.onBack}
    />
  )
}
