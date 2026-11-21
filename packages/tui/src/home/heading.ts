import type { ChangeSummary, TrekEntry, TrekStatus } from "@srctrek/core"
import type { Row } from "./list/rows"
import { type States, stateOf } from "./list/row-state"
import type { Section } from "./list/sections"
import { type StatusBlock, statusBlock } from "./status-block"
import { count } from "../ui/text"

/** What the heading over the list says: the line naming what's selected is of, and its block. */
export type Heading = Readonly<{
  summary: ChangeSummary | undefined
  block: StatusBlock | undefined
}>

/** What the heading needs: both sides, the saved treks, and which keys can build. */
export type HeadingInput = Readonly<{
  status: TrekStatus | undefined
  summary: ChangeSummary | undefined
  entries: readonly TrekEntry[]
  states: States
  canBuild: boolean
  canFind: boolean
  canBuildTrigger: boolean
}>

// The code as it is over the change's repos, for the line over a code row.
function codeSummaryOf(summary: ChangeSummary | undefined): ChangeSummary | undefined {
  if (summary === undefined) {
    return undefined
  }

  const repos = [...summary.changed.map(({ repo }) => repo), ...summary.unchanged]
  return { changed: [], unchanged: repos, code: true }
}

// The change's own heading: its line, and where its trek stands.
function changeHeading(input: HeadingInput): Heading {
  const { status, summary, entries, canBuild } = input
  const entry = entries.find((each) => each.name === status?.name)
  const block = status === undefined ? undefined : statusBlock(status, entry, canBuild, summary)
  return { summary, block }
}

// A saved trek that isn't the change's: where it stands, what it holds, what opens it.
function savedHeading(entry: TrekEntry, input: HeadingInput, summary: ChangeSummary | undefined) {
  const label = stateOf({ kind: "trek", entry }, undefined, input.states)
  const known = label ?? { symbol: "·", state: "saved", tone: "dim" as const }
  if (!entry.valid) {
    return { summary, block: { ...known, name: entry.name, details: [entry.problem] } }
  }

  const block: StatusBlock = {
    ...known,
    name: entry.title,
    holds: `${count(entry.steps, "step")} · ${count(entry.repos, "repo")}`,
    ...(entry.highFlags > 0 ? { flag: `⚠ ${entry.highFlags} likely wrong` } : {}),
    details: [],
    keys: "enter open it · l its builds",
  }
  return { summary, block }
}

// A row of the code as it is: finding its ways in, or a way in and its trek.
function codeHeading(row: Row, input: HeadingInput): Heading {
  const summary = codeSummaryOf(input.summary)
  if (row.kind === "ways-in") {
    return { summary, block: statusBlock(row.status, undefined, input.canFind, { code: true }) }
  }

  if (row.kind === "trigger") {
    const { trigger, trek } = row.found
    const entry = input.entries.find((each) => each.name === trek.name)
    const open = { code: true, trigger: trigger.name }
    const block = statusBlock(trek, entry, input.canBuildTrigger, open)
    return { summary, block: { ...block, name: block.name ?? trigger.name } }
  }

  return row.kind === "trek" ? savedHeading(row.entry, input, summary) : changeHeading(input)
}

/**
 * The heading for the selected row: the change's for its own rows and anything else that isn't a
 * trek, the code as it is for its ways in and their treks, and a saved trek's own for the others.
 */
export function headingFor(
  row: Row | undefined,
  sections: readonly Section[],
  input: HeadingInput,
): Heading {
  const section = sections.find((each) => row !== undefined && each.rows.includes(row))
  if (row !== undefined && section?.id === "code") {
    return codeHeading(row, input)
  }

  const ofChange = section === undefined || section.id === "change" || section.id === "proposal"
  return row?.kind === "trek" && !ofChange
    ? savedHeading(row.entry, input, undefined)
    : changeHeading(input)
}
