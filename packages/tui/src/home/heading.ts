import type { ChangeSummary, TrekEntry, TrekStatus } from "@srctrek/core"
import type { Row } from "./list/rows"
import type { States } from "./list/row-state"
import type { Section } from "./list/sections"
import { statusBlock } from "./status-block"
import { builtWhen, count } from "../ui/text"
import type { Tone } from "../ui/theme"

/** A line of the pane: its text, in a tone other than the text's, italic for what the agent does. */
export type PaneLine = Readonly<{ text: string; tone?: Tone; italic?: boolean }>

/**
 * What the pane beside the list says about the selected row: what it is, then only what the row and
 * the title bar don't already show.
 */
export type Heading = Readonly<{ label: string; lines: readonly PaneLine[] }>

/** What the pane needs: both sides, the saved treks, which keys can build, and the time now. */
export type HeadingInput = Readonly<{
  status: TrekStatus | undefined
  summary: ChangeSummary | undefined
  entries: readonly TrekEntry[]
  states: States
  canBuild: boolean
  canFind: boolean
  canBuildTrigger: boolean
  now: Date
}>

type Valid = Extract<TrekEntry, { valid: true }>

const blank: PaneLine = { text: "" }

// The lines a trek's state adds: what the agent would do, a failed build's last lines, a problem.
function detailLines(
  status: TrekStatus,
  canBuild: boolean,
  open: { code: boolean; trigger?: string },
): PaneLine[] {
  return statusBlock(status, undefined, canBuild, open).details.map((text) => ({
    text,
    tone: "dim",
    italic: true,
  }))
}

// A saved trek: what it follows, what starts it, its likely-wrong flags, when and from what it was
// built.
function trekLines(entry: Valid, now: Date): PaneLine[] {
  const heads = entry.heads.map(({ head }) =>
    head.kind === "branch" ? head.name : `pr ${String(head.number)}`,
  )
  const from = heads.length === 0 ? "" : ` · ${heads.join(", ")}`
  const flags: PaneLine[] =
    entry.highFlags > 0 ? [{ text: `⚠ ${String(entry.highFlags)} likely wrong`, tone: "bad" }] : []

  return [
    { text: entry.overview },
    blank,
    { text: `trigger  ${entry.trigger}`, tone: "dim" },
    ...flags,
    {
      text: `${count(entry.repos, "repo")} · built ${builtWhen(entry.createdAt, now)}${from}`,
      tone: "dim",
    },
  ]
}

// Your changes across their repos, where there are several: the title bar names only the first.
function repoLines(summary: ChangeSummary | undefined): PaneLine[] {
  const changed = summary?.changed ?? []
  const unchanged = summary?.unchanged ?? []
  if (changed.length + unchanged.length < 2) {
    return []
  }

  const branch = ({ head }: (typeof changed)[number]) =>
    head.kind === "branch" ? head.name : `pr ${String(head.number)}`
  return [
    ...changed.map((repo) => ({
      text: `${repo.repo}  ${branch(repo)} · ${count(repo.commits, "commit")}`,
    })),
    ...unchanged.map((repo): PaneLine => ({ text: `${repo}  passed through`, tone: "dim" })),
    blank,
  ]
}

const entryNamed = (input: HeadingInput, name: string) =>
  input.entries.find((each): each is Valid => each.valid && each.name === name)

// Your changes themselves, before a saved trek stands for them.
function changeHeading(input: HeadingInput): Heading {
  const { status, summary, canBuild } = input
  const details = status === undefined ? [] : detailLines(status, canBuild, { code: false })
  return { label: "your changes", lines: [...repoLines(summary), ...details] }
}

// A saved trek: its own lines, or, for one that isn't valid, its problem.
function savedHeading(entry: TrekEntry, label: string, now: Date): Heading {
  if (!entry.valid) {
    return {
      label: "a file that isn't a valid trek",
      lines: [{ text: entry.problem, tone: "bad" }],
    }
  }

  return { label, lines: trekLines(entry, now) }
}

// Your changes' trek: its own lines, then what its state adds, such as how much changed since.
function yourTrekHeading(entry: TrekEntry, input: HeadingInput): Heading {
  const { label, lines } = savedHeading(entry, "the trek of your changes", input.now)
  const { status } = input
  const details = status === undefined ? [] : detailLines(status, input.canBuild, { code: false })
  return { label, lines: details.length === 0 ? lines : [...lines, blank, ...details] }
}

// A way in: the whole of where it was found, which the row cuts; then its trek, or what building it
// does.
function wayInHeading(row: Extract<Row, { kind: "trigger" }>, input: HeadingInput): Heading {
  const where: PaneLine = { text: row.where, tone: "dim" }
  const entry = entryNamed(input, row.trek.name)
  const rest =
    entry === undefined
      ? detailLines(row.trek, input.canBuildTrigger, { code: true, trigger: row.name })
      : trekLines(entry, input.now)
  return { label: "a way into the code as it is", lines: [where, blank, ...rest] }
}

// A row of the code as it is: finding its ways in, a way in, or another trek of the code.
function codeHeading(row: Row, input: HeadingInput): Heading {
  if (row.kind === "ways-in") {
    const lines = detailLines(row.status, input.canFind, { code: true })
    return { label: "the code's ways in", lines }
  }

  if (row.kind === "trigger") {
    return wayInHeading(row, input)
  }

  return row.kind === "trek"
    ? savedHeading(row.entry, "a trek of the code as it is", input.now)
    : changeHeading(input)
}

/**
 * The pane for the selected row: your changes, their trek, the code as it is, or another saved
 * trek; your changes when nothing is selected.
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

  if (row?.kind !== "trek") {
    return changeHeading(input)
  }

  if (row.entry.name === input.status?.name) {
    return yourTrekHeading(row.entry, input)
  }

  const label = section?.id === "change" ? "a trek of your changes" : "a trek of another branch"
  return savedHeading(row.entry, label, input.now)
}
