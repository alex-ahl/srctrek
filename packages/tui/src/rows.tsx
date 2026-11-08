import type { ProposedRepo, TourEntry, TourStatus, TriggerTour } from "@srctrek/core"

/**
 * A line in the home screen's list: a repo the agent proposes adding, a trigger found in the
 * code, or a saved tour.
 */
export type Row =
  | { kind: "proposal"; proposal: ProposedRepo }
  | { kind: "trigger"; found: TriggerTour }
  | { kind: "tour"; entry: TourEntry }

const SELECTED = "#7dd3fc"
const MUTED = "#7a7f99"

/**
 * Proposed repos first, waiting on the user; then the triggers found for the change, when
 * there are any; then the saved tours.
 */
export function rowsOf(
  entries: TourEntry[],
  status: TourStatus | undefined,
  proposals: ProposedRepo[],
): Row[] {
  const triggers = status?.kind === "triggers" ? status.triggers : []

  return [
    ...proposals.map((proposal): Row => ({ kind: "proposal", proposal })),
    ...triggers.map((found): Row => ({ kind: "trigger", found })),
    ...entries.map((entry): Row => ({ kind: "tour", entry })),
  ]
}

function describeEntry(entry: TourEntry): string {
  if (!entry.valid) {
    return `invalid: ${entry.problem}`
  }

  const flags = entry.highFlags > 0 ? `  ⚠ ${entry.highFlags} high` : ""
  return `${entry.steps} steps${flags}`
}

// Where a trigger's tour stands, in a word or two.
const TOUR_STATE: Partial<Record<TourStatus["kind"], string>> = {
  ready: "toured",
  building: "building…",
  failed: "build failed",
  missing: "not toured yet",
}

function describeTrigger({ trigger, tour }: TriggerTour): string {
  const { file, line } = trigger.evidence

  return `${trigger.kind} · ${file}:${line} · ${TOUR_STATE[tour.kind] ?? ""}`
}

function RowLines({
  title,
  detail,
  selected,
}: {
  title: string
  detail: string
  selected: boolean
}) {
  return (
    <box flexDirection="column" style={{ marginBottom: 1, flexShrink: 0 }}>
      <text {...(selected ? { fg: SELECTED } : {})}>{`${selected ? "▶" : " "} ${title}`}</text>
      <text fg={MUTED}>{`    ${detail}`}</text>
    </box>
  )
}

/** One row: its title, and a line on what it is and where it stands. */
export function RowView({ row, selected }: { row: Row; selected: boolean }) {
  if (row.kind === "proposal") {
    const { name, source, reason } = row.proposal
    return (
      <RowLines
        title={`+ ${name} (proposed repo)`}
        detail={`${source ?? "location unknown"} · ${reason}`}
        selected={selected}
      />
    )
  }

  if (row.kind === "trigger") {
    const { found } = row
    return (
      <RowLines title={found.trigger.name} detail={describeTrigger(found)} selected={selected} />
    )
  }

  const { entry } = row
  const title = entry.valid ? entry.title : entry.name

  return (
    <RowLines
      title={title}
      detail={`${entry.name} · ${describeEntry(entry)}`}
      selected={selected}
    />
  )
}

/** The key a row is drawn under. */
export function rowKey(row: Row): string {
  if (row.kind === "proposal") {
    return `proposal:${row.proposal.name}`
  }

  return row.kind === "trigger" ? `trigger:${row.found.trigger.name}` : `tour:${row.entry.name}`
}
