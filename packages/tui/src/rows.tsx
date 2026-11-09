import { TextAttributes } from "@opentui/core"
import type { ProposedRepo, TrekEntry, TrekState, TrekStatus, TriggerTrek } from "@srctrek/core"
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

const DONE_WORD: Readonly<Record<Extract<TrekState, { kind: "done" }>["why"], string>> = {
  merged: "merged",
  gone: "branch gone",
  committed: "committed",
}

// A saved trek's state as a row shows it; none while unchecked.
function savedLabel(state: TrekState | undefined): StateLabel | undefined {
  if (state === undefined || state.kind === "unchecked") {
    return undefined
  }

  if (state.kind === "current") {
    return { symbol: "●", state: "ready", colour: COLOUR.good }
  }

  if (state.kind === "stale") {
    return { symbol: "●", state: "stale", colour: COLOUR.warn }
  }

  if (state.kind === "done") {
    return { symbol: "✓", state: DONE_WORD[state.why], colour: COLOUR.dim }
  }

  return { symbol: "✕", state: "can't open", colour: COLOUR.bad }
}

type States = ReadonlyMap<string, TrekState>

/**
 * Where a row stands, as far as it's known: a trigger's trek; the change's own trek, from the
 * change's status; a trek that isn't valid; any other trek, from its state once it's checked.
 */
function stateOf(row: Row, status: TrekStatus | undefined, states: States): StateLabel | undefined {
  if (row.kind === "trigger") {
    return statusBlock(row.found.trek, undefined, false)
  }

  if (row.kind === "proposal") {
    return undefined
  }

  if (!row.entry.valid) {
    return INVALID
  }

  if (status?.name === row.entry.name) {
    return statusBlock(status, row.entry, false)
  }

  return savedLabel(states.get(row.entry.name))
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

export function columnsOf(
  rows: readonly Row[],
  status: TrekStatus | undefined,
  states: States,
): Columns {
  const valid = rows.flatMap((row) => (row.kind === "trek" && row.entry.valid ? [row.entry] : []))
  const labels = rows.flatMap((row) => {
    const label = stateOf(row, status, states)
    return label === undefined ? [] : [`${label.symbol} ${label.state}`]
  })

  return {
    name: Math.min(NAME_MAX, widest(rows.map(nameOf))) + GAP,
    state: column(labels),
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
  // where every other saved trek stands, as far as it's known yet
  states: States
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
  const { columns, status, states } = context
  const label = stateOf({ kind: "trek", entry }, status, states)
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
