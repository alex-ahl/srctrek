import { useRenderer } from "@opentui/react"
import {
  type ChangeChoice,
  type ProposedRepo,
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
import type { WaysInActions } from "./change/ways-in"
import { type Editor, openInEditor } from "./editors/editors"
import type { Pick } from "./landing/rows"
import { Landing } from "./landing/screen"
import { type Pending, PendingScreen, failureReason } from "./opening"
import { SettingsScreen } from "./settings/screen"
import type { Sources } from "./sources"
import { SteppingScreen } from "./stepping/screen"
import { TonesContext } from "./ui/theme"
import { useFollow } from "./watch/follow"
import { useSettings } from "./watch/use-settings"
import { useTerminalTones } from "./watch/use-terminal-tones"

/** What trek opens on: the landing page, or the change its args name, already worked out. */
export type Opening =
  | Readonly<{ kind: "landing" }>
  | Readonly<{ kind: "change"; choice: ChangeChoice; change: OpenChange; status: TrekStatus }>

/** A screen open, the one in front drawn, those under it gone back to in turn. */
type Shown =
  | Readonly<{ kind: "landing" }>
  | Readonly<{ kind: "pending"; pending: Pending }>
  | Readonly<{
      kind: "change"
      choice: ChangeChoice
      change: OpenChange
      status: TrekStatus
      proposals: ProposedRepo[]
    }>
  // a trek whose change is gone, on a change's screen with just the trek
  | Readonly<{ kind: "done"; name: string }>
  | Readonly<{ kind: "stepping"; name: string }>
  | Readonly<{ kind: "builds"; name: string; change: OpenChange | undefined }>
  | Readonly<{ kind: "settings" }>

type Props = {
  root: string
  opening: Opening
  sources: Sources
  firstSettings: Settings
  // the editors treks can be stepped in here
  editors: readonly Editor[]
  onQuit: () => void
}

const LANDING: Shown = { kind: "landing" }
const OWN: ChangeChoice = { kind: "own", uncommitted: false }

const firstShown = (opening: Opening): Shown =>
  opening.kind === "landing" ? LANDING : { ...opening, proposals: [] }

// The change the screens in front are about, nearest the front; the user's own branch on the
// landing page.
function changeIn(stack: readonly Shown[]): Extract<Shown, { kind: "change" }> | undefined {
  return stack.findLast((shown) => shown.kind === "change")
}

/** The screens open, front last: opened in front, gone back from, the front one replaced. */
function useStack(opening: Opening) {
  const [stack, setStack] = useState<readonly Shown[]>(() => [firstShown(opening)])
  const open = (shown: Shown) => setStack((now) => [...now, shown])
  // back from the front screen; from the last one, to the landing page
  const back = () => setStack((now) => (now.length > 1 ? now.slice(0, -1) : [LANDING]))
  // what was in front is now `next`, unless the user has gone back from it meanwhile
  const replace = (was: Shown, next: Shown) =>
    setStack((now) => (now.at(-1) === was ? [...now.slice(0, -1), next] : now))
  const update = (was: Shown, next: Shown) =>
    setStack((now) => now.map((shown) => (shown === was ? next : shown)))

  return { stack, open, back, replace, update }
}

// A trek's title, once the saved treks are read; its name until then.
function titleOf(entries: readonly TrekEntry[], name: string): string {
  const entry = entries.find((each) => each.name === name)
  return entry?.valid === true ? entry.title : name
}

/**
 * trek's screens: the landing page, a change's screen, stepping a trek, its builds, and the
 * settings; each opened in front of the last and gone back from with esc or q. While open, the
 * change in front follows the worktree, and the landing page lists what's there now.
 */
export function App(props: Props) {
  const { root, sources, editors } = props
  const renderer = useRenderer()
  const { stack, open, back, replace, update } = useStack(props.opening)
  const front = stack.at(-1) ?? LANDING
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

  const following = changeIn(stack)
  useFollow(sources.stamp, following?.choice ?? OWN, async () => {
    if (following !== undefined) {
      const change = await sources.open(choiceArguments(following.choice))
      update(following, { ...following, change })
    }

    setGeneration((was) => was + 1)
  })

  // A change picked or followed: worked out on a screen of its own, then shown in its place.
  const openChoice = (choice: ChangeChoice) => {
    const pending: Shown = { kind: "pending", pending: { kind: "opening", choice } }
    open(pending)
    const opening = async () => {
      const change = await sources.open(choiceArguments(choice))
      const status = await change.status()
      replace(pending, { kind: "change", choice, change, status, proposals: [] })
    }

    opening().catch((error: unknown) =>
      replace(pending, {
        kind: "pending",
        pending: { kind: "failed", choice, why: failureReason(error) },
      }),
    )
  }

  const pick = (picked: Pick) => {
    setFrom(picked)
    if (picked.kind === "trek") {
      open({ kind: "done", name: picked.name })
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

  const changeScreen = (shown: Extract<Shown, { kind: "change" }>): ReactNode => {
    const { change, choice } = shown
    const { summary } = change
    const waysIn: WaysInActions | undefined =
      summary.code && summary.trigger === undefined
        ? {
            stepTrek: (name) => open({ kind: "stepping", name }),
            buildTrigger: change.buildTrigger ?? (() => Promise.resolve()),
            follow: (trigger) =>
              openChoice({ kind: "code", trigger, ...(choice.repos && { repos: choice.repos }) }),
          }
        : undefined
    return (
      <ChangeScreen
        key={stack.length}
        root={root}
        summary={summary}
        status={shown.status}
        proposals={shown.proposals}
        reads={{ status: change.status, build: readLatest, proposals: sources.proposals }}
        actions={changeActions(change)}
        waysIn={waysIn}
        generation={generation}
      />
    )
  }

  // a trek whose change is gone: its screen with just the trek, which can't be built again
  const doneScreen = (name: string): ReactNode => {
    const status: TrekStatus = { kind: "ready", name }
    return (
      <ChangeScreen
        key={stack.length}
        root={root}
        summary={undefined}
        status={status}
        proposals={[]}
        reads={{
          status: () => Promise.resolve(status),
          build: readLatest,
          proposals: sources.proposals,
        }}
        actions={changeActions(undefined)}
      />
    )
  }

  const screen = (): ReactNode => {
    if (front.kind === "landing") {
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

    if (front.kind === "pending") {
      return <PendingScreen pending={front.pending} onBack={back} />
    }

    if (front.kind === "change") {
      return changeScreen(front)
    }

    if (front.kind === "done") {
      return doneScreen(front.name)
    }

    if (front.kind === "stepping") {
      return (
        <SteppingScreen
          root={root}
          editor={chosenEditor?.command ?? process.env["EDITOR"]}
          name={front.name}
          title={titleOf(entries, front.name)}
          onBack={back}
          tint={tint}
        />
      )
    }

    if (front.kind === "builds") {
      return (
        <Builds
          name={front.name}
          title={titleOf(entries, front.name)}
          change={front.change}
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

  return <TonesContext.Provider value={tones}>{screen()}</TonesContext.Provider>
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
