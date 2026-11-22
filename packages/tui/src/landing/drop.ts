import { type RepoBranch, type RepoBranches, type RepoPick, baseName } from "@srctrek/core"

/**
 * A repo's branches open under its row: which line is selected, whether all are shown or the few
 * likely ones, what's typed to narrow them, and a fetch on its way or failed.
 */
export type Drop = Readonly<{
  path: string
  at: number
  all: boolean
  query: string
  fetch: { kind: "fetching" } | { kind: "failed"; why: string } | undefined
}>

/**
 * A line of the drop: a branch to take, the rest folded under a count, the default branch, or
 * fetching to look for branches pushed since.
 */
export type DropRow = Readonly<
  | { kind: "branch"; branch: RepoBranch; pick: RepoPick }
  | { kind: "more"; count: number }
  | { kind: "base"; name: string; pick: RepoPick }
  | { kind: "fetch" }
>

// The likely ones: the most recently committed to, and the one checked out wherever it sits.
const FEW = 3

/** A drop just opened on the repo at `path`. */
export function opened(path: string): Drop {
  return { path, at: 0, all: false, query: "", fetch: undefined }
}

const matching = (query: string) => (branch: RepoBranch) => {
  const typed = query.toLowerCase()
  return [branch.name, branch.author, branch.subject].some((text) =>
    text.toLowerCase().includes(typed),
  )
}

// The branches shown: all once asked for or narrowed, else the few likely ones.
function shown(branches: readonly RepoBranch[], drop: Drop): readonly RepoBranch[] {
  if (drop.all || drop.query !== "") {
    return branches
  }

  const few = branches.slice(0, FEW)
  const checkedOut = branches.slice(FEW).filter((branch) => branch.checkedOut)
  return [...few, ...checkedOut]
}

/**
 * The drop's lines for a repo's branches: those shown, the rest under a count, its default branch,
 * which passes it through, then a line to fetch. Taking the checked-out branch names none, so the
 * repo follows what it has out.
 */
export function dropRows(found: RepoBranches, drop: Drop): DropRow[] {
  const branches = found.branches.filter(matching(drop.query))
  const listed = shown(branches, drop)
  const hidden = branches.length - listed.length
  const base = baseName(found.base)

  const rows: DropRow[] = listed.map((branch) => ({
    kind: "branch",
    branch,
    pick: branch.checkedOut
      ? { path: drop.path, changed: branch.commits > 0 }
      : { path: drop.path, changed: true, branch: branch.name },
  }))
  const more: DropRow[] = hidden > 0 ? [{ kind: "more", count: hidden }] : []
  const baseShown = drop.query === "" || base.includes(drop.query.toLowerCase())
  const baseRow: DropRow[] = baseShown
    ? [{ kind: "base", name: base, pick: { path: drop.path, changed: false, branch: base } }]
    : []

  return [...rows, ...more, ...baseRow, { kind: "fetch" }]
}
