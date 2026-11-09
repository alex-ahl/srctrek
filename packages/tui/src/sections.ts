import type { ChangeSummary, RangeHead, TrekEntry, TrekState, TrekStatus } from "@srctrek/core"
import type { Row } from "./rows"

/**
 * The home screen's sections, in order: repos the agent proposed and ways into the code, which
 * wait on the user; treks of this change (its own and others of its branches); treks of other
 * branches and pull requests; treks of code as it is; then treks whose work is done, and files
 * that aren't valid treks, which start folded.
 */
export type SectionId = "proposal" | "trigger" | "change" | "other" | "code" | "done" | "invalid"

export type Section = Readonly<{ id: SectionId; title: string; rows: readonly Row[] }>

const ORDER: readonly SectionId[] = [
  "proposal",
  "trigger",
  "change",
  "other",
  "code",
  "done",
  "invalid",
]

const TITLES: Readonly<Record<SectionId, string>> = {
  proposal: "PROPOSED BY THE AGENT",
  trigger: "WAYS INTO THIS CODE",
  change: "THIS CHANGE",
  other: "OTHER BRANCHES AND PULL REQUESTS",
  code: "CODE AS IT IS",
  done: "DONE",
  invalid: "CAN'T READ",
}

/** Sections that fold: their rows show only once the user opens them. */
export const FOLDING: ReadonlySet<SectionId> = new Set(["done", "invalid"])

/** What placing a trek needs: the change it's on, and where each saved trek stands. */
export type Placing = Readonly<{
  status: TrekStatus | undefined
  summary: ChangeSummary | undefined
  states: ReadonlyMap<string, TrekState>
}>

// A trek of this change's branches: in every repo the change touches, its head is the change's.
function isOfChange(
  entry: Extract<TrekEntry, { valid: true }>,
  summary: ChangeSummary | undefined,
): boolean {
  const changed = summary?.changed ?? []
  const sameHead = ({ repo, head }: ChangeSummary["changed"][number]) =>
    entry.heads.some((recorded) => recorded.repo === repo && sameBranch(recorded.head, head))

  return changed.length > 0 && changed.every(sameHead)
}

function sameBranch(a: RangeHead, b: RangeHead): boolean {
  return a.kind === "branch" && b.kind === "branch" && a.name === b.name
}

// A saved trek's section: the change's own trek is always the change's; otherwise done before
// anything else, then by what it's of.
function trekSection(entry: TrekEntry, placing: Placing): SectionId {
  if (!entry.valid) {
    return "invalid"
  }

  if (entry.name === placing.status?.name) {
    return "change"
  }

  if (placing.states.get(entry.name)?.kind === "done") {
    return "done"
  }

  if (entry.code) {
    return "code"
  }

  return isOfChange(entry, placing.summary) ? "change" : "other"
}

function sectionOf(row: Row, placing: Placing): SectionId {
  return row.kind === "trek" ? trekSection(row.entry, placing) : row.kind
}

/** The rows in their sections, in order, leaving out sections with none. */
export function sectionsOf(rows: readonly Row[], placing: Placing): Section[] {
  const placed = rows.map((row) => ({ row, id: sectionOf(row, placing) }))

  return ORDER.flatMap((id) => {
    const inSection = placed.filter((each) => each.id === id).map((each) => each.row)
    return inSection.length === 0 ? [] : [{ id, title: TITLES[id], rows: inSection }]
  })
}
