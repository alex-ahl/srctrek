import type { MoveTarget, StepRef, StepView } from "@srctrek/core"

/**
 * A move's key, what it does in words, the code line it's about (a call's), and where it lands
 * when the words don't say, with its file and line when the place is a name.
 */
export type MoveRow = Readonly<{
  key: string
  text: string
  line: number | undefined
  to: Landing | undefined
}>

export type Landing = Readonly<{ place: string; at: string | undefined }>

type Named = Pick<StepRef, "name" | "file" | "start_line">

const fileLine = (ref: Named) =>
  `${ref.file.split("/").at(-1) ?? ref.file}:${String(ref.start_line)}`

const nameOf = (ref: Named) => ref.name ?? fileLine(ref)

// Where a move lands: its name, with its repo when that isn't the step's; the end past the last.
function placeOf(target: MoveTarget | null, repo: string): string {
  if (target === null) {
    return "the end"
  }

  return target.repo === repo ? nameOf(target) : `${target.repo}: ${nameOf(target)}`
}

// Where a move lands, findable: StateLine at screen.tsx:216, a step with no name by its file
// alone; the end past the last.
function landingOf(target: MoveTarget | null, repo: string): Landing {
  const at = target?.name == null ? undefined : fileLine(target)
  return { place: placeOf(target, repo), at }
}

// Where n goes in words: into a call, across a hop, back to a caller, on, or the end.
function nextRow(view: StepView): MoveRow {
  const { next, moves } = view
  const place = placeOf(moves.next, view.repo)
  const words = {
    into: `into ${place}`,
    hop: `↯ ${place}`,
    back: `back to ${place}`,
    on: `on to ${place}`,
    end: "the end",
  }

  return { key: "n", text: words[next.how], line: next.line ?? undefined, to: undefined }
}

// Into the call on its own line, where that isn't where n goes.
function intoRow(view: StepView): MoveRow[] {
  const target = view.moves.into
  if (target === null || target.id === view.moves.next?.id) {
    return []
  }

  const call = view.calls.find((each) => each.id === target.id)
  const line = call?.call_line ?? undefined
  return [{ key: "i", text: `into ${placeOf(target, view.repo)}`, line, to: undefined }]
}

// What over skips: the step's one call and its line, else its calls.
function skipped(view: StepView): Pick<MoveRow, "text" | "line"> {
  const [only, ...more] = view.calls
  if (only === undefined || more.length > 0) {
    return { text: "skip its calls", line: undefined }
  }

  return { text: `skip ${nameOf(only)}`, line: only.call_line ?? undefined }
}

// Over and out, where they land somewhere n doesn't.
function leavingRows(view: StepView): MoveRow[] {
  const { moves } = view
  const elsewhere = (target: MoveTarget | null) => target?.id !== moves.next?.id
  const over: MoveRow = { key: "O", ...skipped(view), to: landingOf(moves.over, view.repo) }
  const out: MoveRow = {
    key: "o",
    text: `finish ${nameOf(view)}`,
    line: undefined,
    to: landingOf(moves.out, view.repo),
  }

  return [...(elsewhere(moves.over) ? [over] : []), ...(elsewhere(moves.out) ? [out] : [])]
}

/** Each move from the step, n first; one landing where n does isn't repeated. */
export function moveRows(view: StepView): MoveRow[] {
  return [nextRow(view), ...intoRow(view), ...leavingRows(view)]
}

/** The keys of the moves about `line`, "n O", for the end of that line in the code. */
export function keysOn(rows: readonly MoveRow[], line: number): string {
  return rows
    .filter((row) => row.line === line)
    .map((row) => row.key)
    .join(" ")
}
