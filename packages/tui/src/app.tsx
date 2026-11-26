import { useRenderer, useTerminalDimensions } from "@opentui/react"
import {
  type ChangeChoice,
  type OpenPullRequest,
  type PullRequestDetails,
  type Settings,
  type TrekEntry,
  type TrekStatus,
  choiceArguments,
  findsWaysIn,
} from "@srctrek/core"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BuildScreen } from "./build-view/screen"
import { useChangeBeside } from "./change/beside"
import type { ChangeActions } from "./change/keys"
import type { OpenChange } from "./change/open-change"
import { ChangeScreen } from "./change/screen"
import { WaysInScreen } from "./change/ways-in-screen"
import { type Editor, openInEditor } from "./editors/editors"
import type { Pick } from "./landing/rows"
import { SPLIT_FROM, besideWidth } from "./landing/beside"
import { Landing } from "./landing/screen"
import { PendingScreen } from "./opening"
import { type Rested, detailsOf, startedIfAutomatic, usePreparing } from "./preparing"
import { SettingsScreen } from "./settings/screen"
import type { Sources } from "./sources"
import { type ChangeOpen, type Screen, useStack } from "./stack"
import { type Shown, changeInFront, useStanding } from "./standing"
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

// When a saved trek was built, once the saved treks are read.
function builtAtOf(entries: readonly TrekEntry[], name: string): string | undefined {
  const entry = entries.find((each) => each.name === name)
  return entry?.valid === true ? entry.createdAt : undefined
}

/**
 * trek's screens: the landing page, a change's screen, stepping a trek, its builds, and the
 * settings; each opened in front of the last and gone back from with esc or q. Where the change in
 * front stands is kept here, on the stack; while open, it follows the worktree, and the landing
 * page lists what's there now.
 */
export function App(props: Props) {
  const { root, sources, editors } = props
  const renderer = useRenderer()
  const { width } = useTerminalDimensions()
  const { stack, open, back, replace, update } = useStack(props.opening)
  const front = stack.at(-1)
  const onLanding = front === undefined || front.kind === "landing"
  // where there's room, the change the selection rests on is shown beside the landing page's list
  const split = onLanding && width >= SPLIT_FROM
  // moves on as the worktree does, for what's shown to be read again
  const [generation, setGeneration] = useState(0)
  // the pull requests as last listed, read again each minute: their titles, authors, and drafts
  const [pulls, setPulls] = useState<readonly OpenPullRequest[]>([])
  const detailsFor = (choice: ChangeChoice) =>
    choice.kind === "pull-request" ? listedDetails(pulls, choice.url) : undefined
  const [entries, setEntries] = useState<readonly TrekEntry[]>([])
  const { settings, changeSetting } = useSettings(props.firstSettings)
  const { tint, tones } = useTerminalTones(settings.colours)
  const chosenEditor = editors.find((each) => each.id === settings.step_in)
  const inFront = useRef(front)
  inFront.current = front
  const landingInFront = () => inFront.current?.kind === "landing"
  const preparing = usePreparing({ sources, settings, open, replace, landingInFront })
  const setStatus = (id: number, status: TrekStatus) => update(id, (was) => ({ ...was, status }))
  const { proposal, run, readProposals } = useStanding(
    split ? restedShown(preparing.rested) : changeInFront(front),
    sources,
    (status) =>
      split ? preparing.restedStatus(status) : front !== undefined && setStatus(front.id, status),
  )

  useEffect(() => {
    void sources.entries().then(setEntries, () => undefined)
  }, [sources, generation])

  // trek's args name the change it opens on, worked out before the screens start; a pull request's
  // details follow, and its build starts where the settings build automatically
  useEffect(() => {
    const first = props.opening
    if (first.kind === "change") {
      void detailsOf(first.choice, sources).then(
        (details) => details !== undefined && update(0, (was) => ({ ...was, details })),
      )
      void startedIfAutomatic(first, settings).then(
        (started) => started !== first && setStatus(0, started.status),
      )
    }
    // only the change trek opened on
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // the change nearest the front, reopened as the worktree moves on
  const following = stack.findLast((screen) => screen.kind === "change")
  useFollow(sources.stamp, following?.choice ?? OWN, async () => {
    if (following !== undefined) {
      const change = await sources.open(choiceArguments(following.choice))
      const status = await change.status()
      update(following.id, (was) => ({ ...was, change, status }))
      await readProposals()
    }

    preparing.forget()
    setGeneration((was) => was + 1)
  })

  const pick = (picked: Pick) => {
    if (picked.kind === "trek") {
      open({ kind: "done", name: picked.name, why: picked.why })
    } else {
      preparing.openChoice(picked, true)
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
  const beside = useChangeBeside({
    rested: preparing.rested,
    readOverview: sources.overview,
    readBuild: readLatest,
    proposal,
    detailsFor,
    builtAtOf: (name) => builtAtOf(entries, name),
    actionsFor: changeActions,
    run,
    generation,
    width: besideWidth(width),
    openWaysIn: (change) => open(change),
  })

  // the landing page's lists, asked again as the worktree moves on
  const landing = useMemo(
    () => ({
      load: () => sources.load(),
      pullRequests: () =>
        sources.pullRequests().then((listed) => {
          setPulls(listed)
          return listed
        }),
      nearby: () => sources.nearby(),
      done: () => sources.done(),
      entries: () => sources.entries(),
      flagged: (name: string) => sources.overview(name).then((view) => (view?.flags.high ?? 0) > 0),
    }),
    // a new generation is a new set, for the page to ask again
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [sources, generation],
  )

  // A change's screen, or, for code as it is once its ways in are found, those.
  const changeScreen = ({ change, choice, status, ...shown }: ChangeOpen): ReactNode => {
    if (status.kind === "triggers") {
      const repos = choice.repos && { repos: choice.repos }
      return (
        <WaysInScreen
          summary={change.summary}
          ways={status.triggers}
          actions={{
            stepTrek: (name) => open({ kind: "stepping", name }),
            buildTrigger: change.buildTrigger ?? (() => Promise.resolve()),
            follow: (trigger) => preparing.openChoice({ kind: "code", trigger, ...repos }, false),
          }}
          find={change.build}
          run={run}
          back={back}
        />
      )
    }

    return (
      <ChangeScreen
        readOverview={sources.overview}
        summary={change.summary}
        details={shown.details ?? detailsFor(choice)}
        builtAt={builtAtOf(entries, status.name)}
        overview={shown.overview}
        status={status}
        proposal={proposal}
        readBuild={readLatest}
        actions={changeActions(change)}
        run={run}
        generation={generation}
      />
    )
  }

  // the screens over the landing page; the landing page is drawn on its own, kept under them
  const screen = (shown: Screen): ReactNode => {
    if (shown.kind === "landing") {
      return undefined
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
          readOverview={sources.overview}
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

  // The landing page stays under the screens opened over it, drawn only in front, so going back
  // finds it at once as it was left. The screen in front is keyed by itself, so one opened in
  // another's place starts afresh.
  return (
    <TonesContext.Provider value={tones}>
      <Landing
        {...landing}
        active={onLanding}
        repoBranches={sources.repoBranches}
        fetchRepo={sources.fetchRepo}
        status={sources.status}
        pullStatus={sources.pullStatus}
        opening={preparing.opening}
        onRest={(choice) => choice.kind !== "trek" && preparing.rest(choice)}
        onListed={preparing.ahead}
        onPick={pick}
        onSettings={() => open({ kind: "settings" })}
        onQuit={props.onQuit}
        tint={tint}
        split={split ? { beside } : undefined}
      />
      {!onLanding && (
        <box key={front.id} style={{ width: "100%", height: "100%" }}>
          {screen(front)}
        </box>
      )}
    </TonesContext.Provider>
  )
}

// A pull request's title, who opened it, and whether it's a draft, as last listed.
function listedDetails(
  pulls: readonly OpenPullRequest[],
  url: string,
): PullRequestDetails | undefined {
  const pr = pulls.find((each) => each.url === url)
  return pr && { title: pr.title, author: pr.author, draft: pr.draft }
}

// The change the landing page's selection rests on, as the change shown, once it's worked out.
function restedShown(rested: Rested | undefined): Shown {
  return rested?.screen.kind === "change"
    ? { key: `rested ${rested.key}`, change: rested.screen.change, status: rested.screen.status }
    : undefined
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
      findsWaysIn={summary !== undefined && findsWaysIn(summary)}
      read={read}
      onStop={() => void sources.stopBuild(name)}
      onBuildAgain={build === undefined ? undefined : () => void build()}
      onBack={props.onBack}
    />
  )
}
