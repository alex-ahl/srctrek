import { TextAttributes } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import {
  type BuildProgress,
  type ChangeSummary,
  type DraftStep,
  buildProgress,
} from "@srctrek/core"
import { useCallback, useState } from "react"
import { ChangeLine } from "../home/change-line"
import { Footer, type KeyHint } from "../ui/footer"
import { PADDING } from "../ui/layout"
import { builtWhen, count, fit, wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { TitleBar } from "../ui/title-bar"
import { type BuildRead, buildLabel, clockText, whyEnded } from "./read"
import { useBuild } from "./use-build"
import { useStateText } from "../ui/turning"

type Props = {
  // what's open, for the change's own trek; for any other, the trek by its title or name
  summary: ChangeSummary | undefined
  name: string
  // code as it is with no trigger: the build finds its ways in rather than a trek
  findsWaysIn: boolean
  // the trek's build `back` before its latest, 0 the latest
  read: (back: number) => Promise<BuildRead>
  // stops the build while it runs, and builds again once it failed, where either can
  onStop: (() => void) | undefined
  onBuildAgain: (() => void) | undefined
  onBack: () => void
}

// The last of the agent's reads shown; the count says how many there were, and the log has all.
const READS_SHOWN = 5
// A step's id and repo columns, before its summary.
const ID_WIDTH = 5
const REPO_WIDTH = 8

const FLAG_WORDS = { high: "⚠ likely wrong", medium: "● risky", low: "● worth knowing" } as const

type StepsProps = { build: BuildRead; progress: BuildProgress; saved: boolean; width: number }
function Heading({ title, detail }: { title: string; detail: string }) {
  const tones = useTones()
  return (
    <text fg={tones.dim}>
      {title}
      {detail === "" ? "" : `  ${detail}`}
    </text>
  )
}

// What the agent read, newest in the text colour, as it reads the change.
function Reading({ reads, width }: { reads: readonly string[]; width: number }) {
  const tones = useTones()
  const shown = reads.slice(-READS_SHOWN)
  return (
    <box flexDirection="column" style={{ marginBottom: 1, flexShrink: 0 }}>
      <Heading title="READING" detail={count(reads.length, "read")} />
      {shown.map((line, i) => (
        <text key={i} fg={i === shown.length - 1 ? COLOUR.text : tones.dim}>
          {`  ${fit(line, width - 2)}`}
        </text>
      ))}
    </box>
  )
}

// A step of the draft: its id, repo, and summary, a hop marked, and its flag when it has one.
function StepLine({ step, width }: { step: DraftStep; width: number }) {
  const tones = useTones()
  const flag = step.flag === null ? "" : FLAG_WORDS[step.flag]
  const summary = `${step.kind === "hop" ? "↯ " : ""}${step.summary}`
  const room = width - 2 - ID_WIDTH - REPO_WIDTH - (flag === "" ? 0 : flag.length + 2)

  return (
    <text fg={COLOUR.text}>
      <span fg={tones.dim}>{`  ${step.id.padEnd(ID_WIDTH)}`}</span>
      {fit(step.repo, REPO_WIDTH - 1).padEnd(REPO_WIDTH)}
      {fit(summary, room)}
      {flag !== "" && <span fg={step.flag === "high" ? tones.bad : tones.warn}>{`  ${flag}`}</span>}
    </text>
  )
}

function Steps({ build, progress, saved, width }: StepsProps) {
  const added = count(Math.max(build.steps.length, progress.steps.length), "step")

  return (
    <box flexDirection="column" style={{ marginBottom: 1, flexShrink: 0 }}>
      <Heading title="STEPS" detail={saved ? added : `${added} added`} />
      {build.steps.length > 0
        ? build.steps.map((step) => <StepLine key={step.id} step={step} width={width} />)
        : wrap(progress.steps.join("  "), width - 2).map((line, i) => (
            <text key={i} fg={COLOUR.text}>{`  ${line}`}</text>
          ))}
    </box>
  )
}

// The last round trek mcp turned away, its problems in the warning colour, until one is taken.
function Rejected({ rounds, width }: { rounds: readonly (readonly string[])[]; width: number }) {
  const tones = useTones()
  const last = rounds.at(-1) ?? []
  return (
    <box flexDirection="column" style={{ marginBottom: 1, flexShrink: 0 }}>
      <Heading title="REJECTED" detail={count(rounds.length, "round")} />
      {last
        .flatMap((problem) => wrap(problem, width - 2))
        .map((line, i) => (
          <text key={i} fg={tones.warn}>{`  ${line}`}</text>
        ))}
    </box>
  )
}

function Why({ lines, width }: { lines: readonly string[]; width: number }) {
  const tones = useTones()
  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      <Heading title="WHY" detail="" />
      {lines.map((line, i) => (
        <text key={i} fg={tones.dim}>{`  ${fit(line, width - 2)}`}</text>
      ))}
    </box>
  )
}

// Whether the build ended without a trek, which says why, and whether a rejected round shows: while
// it runs, or as why it ended. Stopped by the user, it ended as asked, with no reason to give.
function showing(build: BuildRead, progress: BuildProgress) {
  const ended = build.state === "failed" && !progress.stopped
  const rejected = progress.rejected.length > 0 && (build.state === "building" || ended)
  return { ended, rejected }
}

// The build as it stands: what was read, the steps once started, rejections, and why it ended.
function Sections({
  build,
  progress,
  width,
}: {
  build: BuildRead
  progress: BuildProgress
  width: number
}) {
  const { ended, rejected } = showing(build, progress)
  return (
    <>
      {progress.title === undefined && <Reading reads={progress.reads} width={width} />}
      {progress.title !== undefined && (
        <Steps build={build} progress={progress} saved={build.state === "done"} width={width} />
      )}
      {progress.title !== undefined && !ended && <Reading reads={progress.reads} width={width} />}
      {rejected && <Rejected rounds={progress.rejected} width={width} />}
      {ended && <Why lines={whyEnded(build)} width={width} />}
    </>
  )
}

// Every line of the log, the end in view as lines arrive, until scrolled back.
function Log({ log }: { log: readonly string[] }) {
  const tones = useTones()
  return (
    <scrollbox focused stickyScroll stickyStart="bottom" style={{ flexGrow: 1 }}>
      {log.map((line, i) => (
        <text key={i} fg={line.startsWith("trek: ") ? tones.dim : COLOUR.text}>
          {line}
        </text>
      ))}
    </scrollbox>
  )
}

// What x and b do as the latest build stands: stop it while it runs, build again once it failed;
// on an older one, nothing.
function actionsOf(build: BuildRead | undefined, back: number, props: Props) {
  const latest = back === 0
  return {
    stop: latest && build?.state === "building" ? props.onStop : undefined,
    again: latest && build?.state === "failed" ? props.onBuildAgain : undefined,
  }
}

function keysFor(onLog: boolean, builds: number, actions: ReturnType<typeof actionsOf>): KeyHint[] {
  return [
    ...(builds > 1 ? [{ key: "←/→", does: "older, newer" }] : []),
    ...(actions.stop === undefined ? [] : [{ key: "x", does: "stop" }]),
    ...(actions.again === undefined ? [] : [{ key: "b", does: "build again" }]),
    { key: "tab", does: onLog ? "the build" : "the log" },
    { key: "esc", does: "back" },
  ]
}

// Which of the trek's builds is shown, when it has kept more than one: "build 2 of 4 · started
// yesterday"; or that it has none to show.
function whichBuild(build: BuildRead, back: number, now: Date): string {
  if (build.count <= 1) {
    return ""
  }

  const started =
    build.started === undefined ? "" : ` · started ${builtWhen(build.started.toISOString(), now)}`
  return `build ${build.count - back} of ${build.count}${started}`
}

type StateProps = {
  build: BuildRead | undefined
  progress: BuildProgress
  back: number
  now: Date
  findsWaysIn: boolean
}

// How the build stands, with the trek's title and the clock, and which build it is.
function StateLine({ build, progress, back, now, findsWaysIn }: StateProps) {
  const tones = useTones()
  const label = buildLabel(build?.state, progress, findsWaysIn)
  const state = useStateText(label)
  const clock = build === undefined ? "" : clockText(build, now)
  const which = build === undefined ? "" : whichBuild(build, back, now)

  return (
    <box flexDirection="column" style={{ marginBottom: 1, flexShrink: 0 }}>
      <text fg={COLOUR.text}>
        {"  "}
        <span fg={tones[label.tone]}>{state}</span>
        {progress.title !== undefined && (
          <span attributes={TextAttributes.BOLD}>{`  ${progress.title}`}</span>
        )}
        <span fg={tones.dim}>{clock === "" ? "" : `  ${clock}`}</span>
      </text>
      {which !== "" && <text fg={tones.dim}>{`    ${which}`}</text>}
    </box>
  )
}

// What's open, how the build stands and which it is, then the sections.
function Overview({
  summary,
  name,
  width,
  ...state
}: Omit<StateProps, "progress"> & {
  summary: ChangeSummary | undefined
  name: string
  width: number
}) {
  const progress = buildProgress(state.build?.log ?? [])

  return (
    <>
      {summary !== undefined && <ChangeLine summary={summary} width={width} />}
      {summary === undefined && <text attributes={TextAttributes.BOLD}>{name}</text>}
      <StateLine {...state} progress={progress} />
      {state.build !== undefined && state.build.count > 0 && (
        <Sections build={state.build} progress={progress} width={width} />
      )}
    </>
  )
}

/**
 * A build as it happens, opened from the home screen: what's open and how the build stands, with
 * its clock, then what the agent read, the steps added, rounds rejected, and why it ended. Tab
 * shows the log itself, following its end.
 */
export function BuildScreen(props: Props) {
  const tones = useTones()
  const { width } = useTerminalDimensions()
  const [back, setBack] = useState(0)
  const { read } = props
  const { build, now } = useBuild(useCallback(() => read(back), [read, back]))
  const [onLog, setOnLog] = useState(false)

  const builds = build?.count ?? 0
  const actions = actionsOf(build, back, props)
  const log = build?.log ?? []
  const keys = new Map<string, () => void>([
    ["escape", props.onBack],
    ["tab", () => setOnLog(!onLog)],
    ["x", () => actions.stop?.()],
    ["b", () => actions.again?.()],
    ["left", () => setBack((at) => Math.min(at + 1, Math.max(0, builds - 1)))],
    ["right", () => setBack((at) => Math.max(0, at - 1))],
  ])
  useKeyboard((key) => keys.get(key.name)?.())

  return (
    <box flexDirection="column" style={{ width: "100%", height: "100%" }}>
      <TitleBar left={<span fg={tones.dim}>{onLog ? "build › log" : "build"}</span>} />
      <box
        flexDirection="column"
        style={{
          flexGrow: 1,
          paddingTop: 1,
          paddingLeft: PADDING,
          paddingRight: PADDING,
          overflow: "hidden",
        }}
      >
        {onLog ? (
          <Log log={log} />
        ) : (
          <scrollbox focused style={{ flexGrow: 1 }}>
            <Overview
              build={build}
              back={back}
              now={now}
              summary={props.summary}
              name={props.name}
              findsWaysIn={props.findsWaysIn}
              width={width - 2 * PADDING}
            />
          </scrollbox>
        )}
      </box>
      <Footer keys={keysFor(onLog, builds, actions)} shown="" />
    </box>
  )
}
