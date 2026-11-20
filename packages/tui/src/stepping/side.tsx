import { TextAttributes } from "@opentui/core"
import { fit, fitPath, wrap } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { FLAGS, flagWords } from "./flags"
import { howNext } from "./next"
import type { RouteStop } from "./route"
import type { Near } from "./use-stepping"

// The column's width, beside the code on a terminal wide enough to spare it.
export const SIDE_WIDTH = 40
const ROOM = SIDE_WIDTH - 2
// What a stop says, beside the code, before it's cut.
const SUMMARY_LINES = 3

// How the trek came to `here` from the stop before it: "back from", "called by", "↯ from web:".
function howBack(here: RouteStop, before: RouteStop): string {
  if (before.repo !== here.repo) {
    return `↯ from ${before.repo}:`
  }

  if (before.depth > here.depth) {
    return "back from"
  }

  return before.depth < here.depth ? "called by" : "after"
}

// What a stop says, in at most a few lines, the last ending in … where it's cut.
function cutSummary(summary: string): string[] {
  const lines = wrap(summary, ROOM)
  if (lines.length <= SUMMARY_LINES) {
    return lines
  }

  const shown = lines.slice(0, SUMMARY_LINES)
  const last = shown.pop() ?? ""
  return [...shown, `${last.slice(0, ROOM - 1)}…`]
}

function Heading({ title, letter }: { title: string; letter: string }) {
  const tones = useTones()
  return (
    <text>
      <span fg={tones.dim}>{`${title}  `}</span>
      <span fg={tones.accent} attributes={TextAttributes.BOLD}>
        {letter}
      </span>
    </text>
  )
}

// Where a neighbouring stop is: "this file · line 40" in the stop's own file, else its repo and
// path, cut from the left so the folder and file show.
function PlaceLine({ stop, from }: { stop: RouteStop; from: RouteStop }) {
  const tones = useTones()
  if (stop.repo === from.repo && stop.file === from.file) {
    return <text fg={tones.dim}>{`this file · line ${String(stop.line)}`}</text>
  }

  const repo = `${stop.repo} · `
  return (
    <text>
      <span fg={tones.dim}>{repo}</span>
      <span fg={COLOUR.text}>
        {fitPath(`${stop.file}:${String(stop.line)}`, ROOM - repo.length)}
      </span>
    </text>
  )
}

// "+ changed  ⚠ likely wrong", whichever of them the stop has.
function MarksLine({ stop }: { stop: RouteStop }) {
  const tones = useTones()
  const flag = stop.flag
  if (!stop.changed && flag === undefined) {
    return null
  }

  return (
    <text>
      <span fg={tones.good}>{stop.changed ? "+ changed" : ""}</span>
      {flag !== undefined && (
        <span fg={tones[FLAGS[flag.severity].tone]}>
          {`${stop.changed ? "  " : ""}${flagWords(flag.severity)}`}
        </span>
      )}
    </text>
  )
}

// A neighbouring stop: how it's reached and its name, where it is, then, when `full`, what it
// says; its change and flag last.
function Neighbour({
  how,
  stop,
  from,
  full,
}: {
  how: string
  stop: RouteStop
  from: RouteStop
  full: boolean
}) {
  const tones = useTones()
  const summary = full ? cutSummary(stop.summary) : []

  return (
    <>
      <text>
        <span fg={tones.dim}>{`${how} `}</span>
        <span fg={COLOUR.text} attributes={TextAttributes.BOLD}>
          {fit(stop.name, Math.max(1, ROOM - how.length - 1))}
        </span>
      </text>
      <PlaceLine stop={stop} from={from} />
      {summary.map((line, i) => (
        <text key={i} fg={COLOUR.text} attributes={TextAttributes.ITALIC}>
          {line}
        </text>
      ))}
      <MarksLine stop={stop} />
    </>
  )
}

// "past 3 folded stops", where n steps past a folded call.
function PastLine({ near }: { near: Near }) {
  const tones = useTones()
  const past = near.next === undefined ? 0 : near.next - near.at - 1
  if (past <= 0) {
    return null
  }

  return <text fg={tones.dim}>{`past ${String(past)} folded stop${past === 1 ? "" : "s"}`}</text>
}

/** Beside the code: where n goes and where p goes back to, the next one in full. */
export function Side({ route, near }: { route: readonly RouteStop[]; near: Near }) {
  const tones = useTones()
  const here = route[near.at]
  const after = route[near.next ?? -1]
  const before = route[near.previous ?? -1]

  return (
    <box flexDirection="column" style={{ width: SIDE_WIDTH, paddingLeft: 2, flexShrink: 0 }}>
      <Heading title="NEXT" letter="n" />
      {after === undefined || here === undefined ? (
        <text fg={tones.dim}>the end of the trek</text>
      ) : (
        <>
          <Neighbour how={howNext(here, after)} stop={after} from={here} full />
          <PastLine near={near} />
        </>
      )}
      <box style={{ marginTop: 1 }}>
        <Heading title="PREVIOUS" letter="p" />
      </box>
      {before === undefined || here === undefined ? (
        <text fg={tones.dim}>the overview</text>
      ) : (
        <Neighbour how={howBack(here, before)} stop={before} from={here} full={false} />
      )}
    </box>
  )
}
