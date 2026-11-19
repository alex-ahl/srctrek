import { type RGBA, TextAttributes } from "@opentui/core"
import type { ProposedRepo, TrekEntry, TrekStatus, TriggerTrek } from "@srctrek/core"
import { type Columns, EDGES, GAP, builtText, flagsText } from "./columns"
import { type States, detailOf, stateOf } from "./row-state"
import { statusBlock } from "../status-block"
import { selectionMarker } from "../../ui/selectable"
import { STATE_LABELS, type StateLabel } from "../../ui/state-labels"
import { COLOUR, useTones } from "../../ui/theme"
import { useStateText } from "../../ui/turning"
import { fit } from "../../ui/text"

/**
 * A line in the home screen's list: a repo the agent proposes adding, a trigger found in the
 * code, or a saved trek.
 */
export type Row =
  | { kind: "proposal"; proposal: ProposedRepo }
  | { kind: "trigger"; found: TriggerTrek }
  | { kind: "trek"; entry: TrekEntry }

// Newest first, as the trek a person wants is usually the one just built; invalid ones last.
function byNewest(a: TrekEntry, b: TrekEntry): number {
  const built = (entry: TrekEntry) => (entry.valid ? entry.createdAt : "")

  return built(b).localeCompare(built(a))
}

/**
 * Proposed repos first, waiting on the user; then the triggers found for the change, when
 * there are any; then the saved treks, newest first.
 */
export function rowsOf(
  entries: TrekEntry[],
  status: TrekStatus | undefined,
  proposals: ProposedRepo[],
): Row[] {
  const triggers = status?.kind === "triggers" ? status.triggers : []

  return [
    ...proposals.map((proposal): Row => ({ kind: "proposal", proposal })),
    ...triggers.map((found): Row => ({ kind: "trigger", found })),
    ...entries.toSorted(byNewest).map((entry): Row => ({ kind: "trek", entry })),
  ]
}

/** What every row needs to line up with the others and say where it stands. */
export type RowContext = Readonly<{
  width: number
  now: Date
  columns: Columns
  // the change's trek and its state, which its row shows
  status: TrekStatus | undefined
  // where every other saved trek stands, as far as it's known yet
  states: States
  // the selected row's background, when the terminal's colours are known
  tint?: RGBA | undefined
}>

// The selection's marker, where no tint shows it.
function Marker({ selected, context }: { selected: boolean; context: RowContext }) {
  return <span fg={useTones().accent}>{selectionMarker(selected, context.tint)}</span>
}

// The row's title in its column, bold when selected, cut to leave a gap before the next column.
function Title({ text, width, selected }: { text: string; width: number; selected: boolean }) {
  const shown = fit(text, width - GAP).padEnd(width)
  return selected ? <span attributes={TextAttributes.BOLD}>{shown}</span> : <span>{shown}</span>
}

// The state in its column, symbol and word in the state's colour; blank when unknown.
function State({ label, width }: { label: StateLabel | undefined; width: number }) {
  const text = useStateText(label)

  const tones = useTones()

  return <span fg={tones[label?.tone ?? "dim"]}>{text.padEnd(width)}</span>
}

// The room after the marker, the state, and the title, for text that fills the rest of a row.
const rest = (context: RowContext) =>
  Math.max(0, context.width - EDGES - context.columns.state - context.columns.title)

// A proposed repo's name, where it lives, and why, across the title and the columns after it;
// the keys that settle it at the end.
function ProposalRow({ item: proposal, selected, context }: RowProps<ProposedRepo>) {
  const tones = useTones()
  const { name, source, reason } = proposal
  const { columns } = context
  const keys = "enter add · x dismiss"
  const room = columns.title + rest(context) - keys.length - GAP - name.length - GAP
  const where = fit(`${source ?? "location unknown"}   ${reason}`, room).padEnd(room + GAP)

  return (
    <text fg={COLOUR.text}>
      <Marker selected={selected} context={context} />
      <State label={STATE_LABELS.proposed} width={columns.state} />
      <span
        {...(selected ? { attributes: TextAttributes.BOLD } : {})}
      >{`${name}${" ".repeat(GAP)}`}</span>
      <span fg={tones.dim}>{where}</span>
      <span fg={tones.dim}>{keys}</span>
    </text>
  )
}

function TriggerRow({ item: found, selected, context }: RowProps<TriggerTrek>) {
  const tones = useTones()
  const { trigger, trek } = found
  const { columns } = context
  const where = `${trigger.kind} · ${trigger.evidence.file}:${trigger.evidence.line}`

  return (
    <text fg={COLOUR.text}>
      <Marker selected={selected} context={context} />
      <State label={statusBlock(trek, undefined, false)} width={columns.state} />
      <Title text={trigger.name} width={columns.title} selected={selected} />
      <span fg={tones.dim}>{fit(where, rest(context))}</span>
    </text>
  )
}

function TrekRow({ item: entry, selected, context }: RowProps<TrekEntry>) {
  const { columns, status, states } = context
  const label = stateOf({ kind: "trek", entry }, status, states)
  const tones = useTones()

  if (!entry.valid) {
    return (
      <text fg={COLOUR.text}>
        <Marker selected={selected} context={context} />
        <State label={label} width={columns.state} />
        <Title text={entry.name} width={columns.title} selected={selected} />
        <span fg={tones.dim}>{fit(entry.problem, rest(context))}</span>
      </text>
    )
  }

  const built = columns.built === 0 ? "" : builtText(entry, context.now)
  return (
    <text fg={COLOUR.text}>
      <Marker selected={selected} context={context} />
      <State label={label} width={columns.state} />
      <Title text={entry.title} width={columns.title} selected={selected} />
      <span fg={tones.dim}>{detailOf(entry, status, states).padEnd(columns.detail)}</span>
      <span fg={tones.bad}>{flagsText(entry).padEnd(columns.flags)}</span>
      <span fg={tones.dim}>{built}</span>
    </text>
  )
}

type RowProps<T> = { item: T; selected: boolean; context: RowContext }

/** One row: where it stands, its title, and in columns what it holds and when it was built. */
export function RowView({
  row,
  selected,
  context,
}: {
  row: Row
  selected: boolean
  context: RowContext
}) {
  if (row.kind === "proposal") {
    return <ProposalRow item={row.proposal} selected={selected} context={context} />
  }

  if (row.kind === "trigger") {
    return <TriggerRow item={row.found} selected={selected} context={context} />
  }

  return <TrekRow item={row.entry} selected={selected} context={context} />
}
