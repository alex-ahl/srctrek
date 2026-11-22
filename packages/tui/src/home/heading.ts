import type { ChangeSummary, TrekEntry, TrekStatus } from "@srctrek/core"
import type { Row } from "./list/rows"
import { type States, stateOf } from "./list/row-state"
import type { Section } from "./list/sections"
import { changeParts } from "./change-line"
import { type StatusBlock, statusBlock } from "./status-block"
import { count } from "../ui/text"

/**
 * What the pane beside the list says about the selected row: what it describes, where it stands
 * (its block), and what it's of, such as the change's branch and commits.
 */
export type Heading = Readonly<{
  label: string
  block: StatusBlock | undefined
  about: string | undefined
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

// "in web, api": the repos the code as it is is read in, the change's own.
function codeRepos(summary: ChangeSummary | undefined): string | undefined {
  const repos = [...(summary?.changed.map(({ repo }) => repo) ?? []), ...(summary?.unchanged ?? [])]
  return repos.length === 0 ? undefined : `in ${repos.join(", ")}`
}

// "development · 6 commits since origin/development": the change, as its line says it.
const changeText = (summary: ChangeSummary | undefined) =>
  summary === undefined
    ? undefined
    : changeParts(summary)
        .map((part) => part.text)
        .join("")

// The change's own heading: its line, and where its trek stands.
function changeHeading(input: HeadingInput): Heading {
  const { status, summary, entries, canBuild } = input
  const entry = entries.find((each) => each.name === status?.name)
  const block = status === undefined ? undefined : statusBlock(status, entry, canBuild, summary)
  return { label: "your changes", block, about: changeText(summary) }
}

// A saved trek that isn't the change's: where it stands and what it holds.
function savedHeading(entry: TrekEntry, input: HeadingInput, label: string): Heading {
  const state = stateOf({ kind: "trek", entry }, undefined, input.states)
  const known = state ?? { symbol: "·", state: "saved", tone: "dim" as const }
  if (!entry.valid) {
    return {
      label: "a file that isn't a valid trek",
      block: { ...known, name: entry.name, details: [entry.problem] },
      about: undefined,
    }
  }

  const block: StatusBlock = {
    ...known,
    name: entry.title,
    holds: `${count(entry.steps, "step")} · ${count(entry.repos, "repo")}`,
    ...(entry.highFlags > 0 ? { flag: `⚠ ${entry.highFlags} likely wrong` } : {}),
    details: [],
  }
  const heads = entry.heads.map(({ head }) =>
    head.kind === "branch" ? head.name : `pr ${String(head.number)}`,
  )
  return { label, block, about: heads.length === 0 ? undefined : `of ${heads.join(", ")}` }
}

// A row of the code as it is: finding its ways in, or a way in and its trek.
function codeHeading(row: Row, input: HeadingInput): Heading {
  const about = codeRepos(input.summary)
  if (row.kind === "ways-in") {
    const block = statusBlock(row.status, undefined, input.canFind, { code: true })
    return { label: "the code's ways in", block, about }
  }

  if (row.kind === "trigger") {
    const { name, trek } = row
    const entry = input.entries.find((each) => each.name === trek.name)
    const block = statusBlock(trek, entry, input.canBuildTrigger, { code: true, trigger: name })
    return {
      label: "a way into the code as it is",
      block: { ...block, name: block.name ?? name },
      about,
    }
  }

  return row.kind === "trek"
    ? savedHeading(row.entry, input, "a trek of the code as it is")
    : changeHeading(input)
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
    ? savedHeading(row.entry, input, "a saved trek")
    : changeHeading(input)
}
