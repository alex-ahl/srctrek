import type { TriggerTrek } from "@srctrek/core"
import { stepped } from "../ui/move"
import type { KeyHint } from "../ui/footer"
import { HELP_HINT, type KeyGroup } from "../ui/keys-help"
import { fit } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"
import { type Ask, BUILD_VERBS, canStep } from "./keys"
import { statusBlock } from "./status-block"

/** What the code's ways in offer: step one's trek, build it, or follow a trigger the user names. */
export type WaysInActions = Readonly<{
  stepTrek: (name: string) => void
  buildTrigger: (trigger: string) => Promise<void>
  follow: (trigger: string) => void
}>

/** A row of the list: a way in, by its trigger's name, or the row that asks for another. */
export type WayRow = Readonly<{ kind: "way"; way: TriggerTrek }> | Readonly<{ kind: "follow" }>

/** The ways in, then the row to follow a trigger the user names. */
export const wayRows = (ways: readonly TriggerTrek[]): WayRow[] => [
  ...ways.map((way): WayRow => ({ kind: "way", way })),
  { kind: "follow" },
]

const keyOf = (row: WayRow) => (row.kind === "way" ? row.way.trigger.name : "")

/** The selected row: the one with the key chosen, so it stays put as the list is read again. */
export function selectedRow(rows: readonly WayRow[], chosen: string | undefined): number {
  const at = rows.findIndex((row) => keyOf(row) === chosen)
  return at === -1 ? 0 : at
}

/** The key of the row `by` from the one selected, kept within the list. */
export const movedKey = (rows: readonly WayRow[], selected: number, by: number) =>
  keyOf(rows[stepped(selected, by, rows.length)] ?? { kind: "follow" })

// The name column, so where each is found lines up.
const NAME_WIDTH = 24

function WayLine({ row, selected, width }: { row: WayRow; selected: boolean; width: number }) {
  const tones = useTones()
  const marker = selected ? "› " : "  "
  if (row.kind === "follow") {
    return <text fg={tones.dim}>{`${marker}  follow a trigger…`}</text>
  }

  const { trigger, trek } = row.way
  const { symbol, tone } = statusBlock(trek, undefined, false)
  const where = `${trigger.evidence.file}:${String(trigger.evidence.line)}`
  return (
    <text fg={COLOUR.text}>
      {marker}
      <span fg={tones[tone]}>{`${symbol} `}</span>
      {fit(trigger.name, NAME_WIDTH - 1).padEnd(NAME_WIDTH)}
      <span fg={tones.dim}>{fit(where, width - NAME_WIDTH - 4)}</span>
    </text>
  )
}

/** The code's ways in, each with its trek's state and where it's found, the selected one marked. */
export function WaysIn(props: { rows: readonly WayRow[]; selected: number; width: number }) {
  const { rows, selected, width } = props
  return (
    <box flexDirection="column">
      {rows.map((row, i) => (
        <WayLine key={keyOf(row)} row={row} selected={i === selected} width={width} />
      ))}
    </box>
  )
}

/** What the ways in's keys need: the row selected, the actions, and how to run, ask, and find. */
export type WaysContext = Readonly<{
  row: WayRow | undefined
  actions: WaysInActions
  // finds the ways in again, and with them gone the way to build a way in's trek: both need an
  // agent, so absent when none is set
  find: (() => Promise<void>) | undefined
  run: (work: Promise<void>) => void
  ask: (ask: Ask) => void
}>

const FOLLOW: Omit<Ask, "answer"> = {
  question: "Follow:",
  hint: "a trigger in your words: a refund request, the nightly import",
}

function rowHints({ row, find }: WaysContext): KeyHint[] {
  if (row?.kind === "follow") {
    return [{ key: "enter", does: "follow one" }]
  }

  const trek = row?.way.trek
  const verb = trek === undefined ? undefined : BUILD_VERBS[trek.kind]
  return [
    ...(trek !== undefined && canStep(trek) ? [{ key: "enter", does: "step its trek" }] : []),
    ...(verb === undefined || find === undefined ? [] : [{ key: "b", does: verb }]),
  ]
}

const findHints = ({ find }: WaysContext): KeyHint[] =>
  find === undefined ? [] : [{ key: "B", does: "find ways in again" }]

/** The footer: what enter and b do to the selected row, then B. */
export const waysHints = (context: WaysContext): KeyHint[] => [
  ...rowHints(context),
  ...findHints(context),
  HELP_HINT,
]

/** Every key of the ways in, for the panel ? opens. */
export const waysGroups = (context: WaysContext): KeyGroup[] => [
  {
    title: "the selected way in",
    keys: [...rowHints(context), { key: "↑/↓", does: "choose a way in (also j/k)" }],
  },
  { title: "the code", keys: findHints(context) },
  { title: "leave", keys: [{ key: "esc", does: "back" }] },
]

// Enter: follow a trigger the user names, or step a way in's trek once there is one.
function enterKey({ row, actions, ask }: WaysContext) {
  if (row?.kind === "follow") {
    ask({ ...FOLLOW, answer: actions.follow })
    return
  }

  if (row !== undefined && canStep(row.way.trek)) {
    actions.stepTrek(row.way.trek.name)
  }
}

// b builds the selected way in's trek, where its state can be built from.
function buildKey({ row, actions, find, run }: WaysContext) {
  const builds = row?.kind === "way" && BUILD_VERBS[row.way.trek.kind] !== undefined
  if (builds && find !== undefined) {
    run(actions.buildTrigger(row.way.trigger.name))
  }
}

/** What the ways in's keys do; moving the selection is the screen's. */
export function waysKeys(context: WaysContext): ReadonlyMap<string, () => void> {
  const { find, run } = context
  return new Map([
    ["return", () => enterKey(context)],
    ["b", () => buildKey(context)],
    ["B", () => find !== undefined && run(find())],
  ])
}
