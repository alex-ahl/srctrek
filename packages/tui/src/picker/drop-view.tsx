import { type RGBA, TextAttributes } from "@opentui/core"
import type { RepoPick } from "@srctrek/core"
import type { Drop, DropRow } from "./drop"
import { fit, shortAge } from "../ui/text"
import { COLOUR, useTones } from "../ui/theme"

/** What the drop under a repo's row shows: its lines, if loaded, and the repo's tick now. */
export type DropView = Readonly<{
  drop: Drop
  rows: readonly DropRow[] | undefined
  pick: RepoPick | undefined
  now: Date
}>

// Under the repo's name, so the drop reads as belonging to it.
const INDENT = "      "
const NAME_WIDTH = 18
const AGE_WIDTH = 10
const AUTHOR_WIDTH = 8
const SUBJECT_WIDTH = 46

// Whether a line is the branch the repo goes along on now.
function isTaken(row: DropRow, pick: RepoPick | undefined): boolean {
  if (row.kind === "more" || row.kind === "fetch" || pick === undefined) {
    return false
  }

  return row.pick.branch === pick.branch && row.pick.changed === pick.changed
}

function corner(index: number, last: number): string {
  if (index === 0) {
    return "┌ "
  }

  return index === last ? "└ " : "│ "
}

function RowText({ row, taken, now }: { row: DropRow; taken: boolean; now: Date }) {
  const tones = useTones()
  if (row.kind === "more") {
    return <span fg={tones.dim}>{`▸ ${row.count} more branches`}</span>
  }

  if (row.kind === "fetch") {
    return <span fg={tones.dim}>↻ look for new branches on the remote</span>
  }

  const name = (
    <span {...(taken ? { attributes: TextAttributes.BOLD } : {})}>
      {fit(row.kind === "base" ? row.name : row.branch.name, NAME_WIDTH).padEnd(NAME_WIDTH)}
    </span>
  )
  if (row.kind === "base") {
    return (
      <span>
        {name}
        <span fg={tones.dim}>its default branch · passes it through</span>
      </span>
    )
  }

  const { branch } = row
  const author = branch.mine ? "you" : branch.author
  return (
    <span>
      {name}
      <span fg={tones.dim}>{shortAge(branch.committedAt, now).padEnd(AGE_WIDTH)}</span>
      <span fg={tones.dim}>{fit(author, AUTHOR_WIDTH - 1).padEnd(AUTHOR_WIDTH)}</span>
      <span>{fit(branch.subject, SUBJECT_WIDTH).padEnd(SUBJECT_WIDTH)}</span>
      {branch.checkedOut && <span fg={tones.dim}>{"  checked out"}</span>}
    </span>
  )
}

// What's typed, while narrowing.
function Typed({ drop }: { drop: Drop }) {
  return drop.query === "" ? null : <text fg={COLOUR.text}>{`${INDENT}/ ${drop.query}▏`}</text>
}

// A fetch on its way, or why it failed.
function Fetching({ drop }: { drop: Drop }) {
  const tones = useTones()
  if (drop.fetch === undefined) {
    return null
  }

  return drop.fetch.kind === "fetching" ? (
    <text fg={tones.busy}>{`${INDENT}◐ fetching from its remotes…`}</text>
  ) : (
    <text fg={tones.bad}>{`${INDENT}✕ couldn't fetch: ${drop.fetch.why}`}</text>
  )
}

/**
 * A repo's branches open under its row: the few likely ones with when, who, and what, the rest
 * under a count, and its default branch last; the selected line on the tint, the branch the repo
 * goes along on now in bold.
 */
export function DropLines({ view, tint }: { view: DropView; tint: RGBA | undefined }) {
  const tones = useTones()
  const { drop, rows, pick, now } = view
  if (rows === undefined) {
    return <text fg={tones.dim}>{`${INDENT}└ finding branches…`}</text>
  }

  const last = rows.length - 1
  return (
    <box flexDirection="column" style={{ flexShrink: 0 }}>
      <Typed drop={drop} />
      <Fetching drop={drop} />
      {rows.length === 0 && <text fg={tones.dim}>{`${INDENT}└ no branch matches`}</text>}
      {rows.map((row, index) => {
        const marked = index === drop.at && tint === undefined
        const line = (
          <text fg={COLOUR.text}>
            <span fg={tones.accent}>{marked ? "    ▶ " : INDENT}</span>
            <span fg={tones.dim}>{corner(index, last)}</span>
            <RowText row={row} taken={isTaken(row, pick)} now={now} />
          </text>
        )
        const key = row.kind === "branch" ? row.branch.name : row.kind
        return index === drop.at && tint !== undefined ? (
          <box key={key} style={{ backgroundColor: tint }}>
            {line}
          </box>
        ) : (
          <box key={key}>{line}</box>
        )
      })}
    </box>
  )
}
