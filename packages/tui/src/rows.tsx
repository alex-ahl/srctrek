import { TextAttributes } from "@opentui/core"
import type { ProposedRepo, TrekEntry, TrekStatus, TriggerTrek } from "@srctrek/core"
import { type StatusBlock, statusBlock } from "./status-block"
import { COLOUR } from "./theme"
import { builtWhen, count, fit } from "./text"

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

type StateLabel = Pick<StatusBlock, "symbol" | "state" | "colour">

const INVALID: StateLabel = { symbol: "✕", state: "invalid", colour: COLOUR.bad }

/**
 * Where a row stands, when it's known: a trigger's trek; the change's own trek; a trek that
 * isn't valid. Other treks' states would need each checked against its change, so they have none.
 */
function stateOf(row: Row, status: TrekStatus | undefined): StateLabel | undefined {
  if (row.kind === "trigger") {
    return statusBlock(row.found.trek, undefined, false)
  }

  if (row.kind === "proposal") {
    return undefined
  }

  if (!row.entry.valid) {
    return INVALID
  }

  return status?.name === row.entry.name ? statusBlock(status, row.entry, false) : undefined
}

// "19 steps · code trek" and "⚠ 1": a valid trek's size and flags.
function stepsText(entry: Extract<TrekEntry, { valid: true }>): string {
  return `${count(entry.steps, "step")}${entry.code ? " · code trek" : ""}`
}

const flagsText = (entry: Extract<TrekEntry, { valid: true }>) =>
  entry.highFlags > 0 ? `⚠ ${entry.highFlags}` : ""

/** How wide each column is, from what the rows hold: 0 for a column no row fills. */
export type Columns = Readonly<{ name: number; state: number; steps: number; flags: number }>

const NAME_MAX = 28
const GAP = 3
// The built column needs room; a narrow terminal leaves it out.
const BUILT_FROM_WIDTH = 90

const widest = (texts: readonly string[]) => Math.max(0, ...texts.map((text) => text.length))
const column = (texts: readonly string[]) => (widest(texts) === 0 ? 0 : widest(texts) + GAP)

function nameOf(row: Row): string {
  if (row.kind === "proposal") {
    return `+ ${row.proposal.name}`
  }

  return row.kind === "trigger" ? row.found.trigger.name : row.entry.name
}

export function columnsOf(rows: readonly Row[], status: TrekStatus | undefined): Columns {
  const valid = rows.flatMap((row) => (row.kind === "trek" && row.entry.valid ? [row.entry] : []))
  const states = rows.flatMap((row) => {
    const label = stateOf(row, status)
    return label === undefined ? [] : [`${label.symbol} ${label.state}`]
  })

  return {
    name: Math.min(NAME_MAX, widest(rows.map(nameOf))) + GAP,
    state: column(states),
    steps: column(valid.map(stepsText)),
    flags: column(valid.map(flagsText)),
  }
}

/** What every row needs to line up with the others and say where the change's trek stands. */
export type RowContext = Readonly<{
  width: number
  now: Date
  columns: Columns
  // the change's trek and its state, which its row shows
  status: TrekStatus | undefined
}>

function Marker({ selected }: { selected: boolean }) {
  return <span fg={COLOUR.accent}>{selected ? "▶ " : "  "}</span>
}

function Name({ text, width, selected }: { text: string; width: number; selected: boolean }) {
  const shown = fit(text, width - GAP).padEnd(width)
  return selected ? <span attributes={TextAttributes.BOLD}>{shown}</span> : <span>{shown}</span>
}

// The state in its column: the symbol in the state's colour, the word dimmed; blank when unknown.
function State({ label, width }: { label: StateLabel | undefined; width: number }) {
  if (label === undefined) {
    return <span>{"".padEnd(width)}</span>
  }

  return (
    <>
      <span fg={label.colour}>{label.symbol}</span>
      <span fg={COLOUR.dim}>{` ${label.state}`.padEnd(width - 1)}</span>
    </>
  )
}

// The space left after the marker and the given columns, for text that fills the rest.
const rest = (context: RowContext, used: number) => Math.max(0, context.width - 4 - used)

function ProposalRow({ item: proposal, selected, context }: RowProps<ProposedRepo>) {
  const { source, reason } = proposal
  const { columns } = context
  const where = `${source ?? "location unknown"}   ${reason}`

  return (
    <text fg={COLOUR.text}>
      <Marker selected={selected} />
      <span fg={COLOUR.warn}>+ </span>
      <Name text={proposal.name} width={columns.name - 2} selected={selected} />
      <span fg={COLOUR.dim}>{fit(where, rest(context, columns.name))}</span>
    </text>
  )
}

function TriggerRow({ item: found, selected, context }: RowProps<TriggerTrek>) {
  const { trigger, trek } = found
  const { columns } = context
  const where = `${trigger.kind}   ${trigger.evidence.file}:${trigger.evidence.line}`

  return (
    <text fg={COLOUR.text}>
      <Marker selected={selected} />
      <Name text={trigger.name} width={columns.name} selected={selected} />
      <State label={statusBlock(trek, undefined, false)} width={columns.state} />
      <span fg={COLOUR.dim}>{fit(where, rest(context, columns.name + columns.state))}</span>
    </text>
  )
}

function TrekRow({ item: entry, selected, context }: RowProps<TrekEntry>) {
  const { columns, status } = context
  const label = stateOf({ kind: "trek", entry }, status)
  const name = <Name text={entry.name} width={columns.name} selected={selected} />

  if (!entry.valid) {
    return (
      <text fg={COLOUR.text}>
        <Marker selected={selected} />
        {name}
        <State label={label} width={columns.state} />
        <span fg={COLOUR.dim}>
          {fit(entry.problem, rest(context, columns.name + columns.state))}
        </span>
      </text>
    )
  }

  const built = context.width >= BUILT_FROM_WIDTH ? builtWhen(entry.createdAt, context.now) : ""
  return (
    <text fg={COLOUR.text}>
      <Marker selected={selected} />
      {name}
      <State label={label} width={columns.state} />
      <span fg={COLOUR.dim}>{stepsText(entry).padEnd(columns.steps)}</span>
      <span fg={COLOUR.bad}>{flagsText(entry).padEnd(columns.flags)}</span>
      <span fg={COLOUR.dim}>{built}</span>
    </text>
  )
}

type RowProps<T> = { item: T; selected: boolean; context: RowContext }

/** One row: its name and, in columns, what it is and where it stands. */
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
