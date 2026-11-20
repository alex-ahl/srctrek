import type { MoveTarget, StepView } from "@srctrek/core"

// A stop by its name, else its file and line; with its repo when that isn't the step's.
function placeOf(target: MoveTarget, repo: string): string {
  const name =
    target.name ?? `${target.file.split("/").at(-1) ?? target.file}:${String(target.start_line)}`
  return target.repo === repo ? name : `${target.repo}: ${name}`
}

const HOW = { into: "into", hop: "↯ hop to", back: "back to", on: "on to" } as const

/** Where n goes, as how it leaves the stop and the place: "into" "pay", "↯ hop to" "web: Build". */
export function nextParts(view: StepView): Readonly<{ how: string; place: string }> | undefined {
  const { next, moves } = view
  if (moves.next === null || next.how === "end") {
    return undefined
  }

  return { how: HOW[next.how], place: placeOf(moves.next, view.repo) }
}

/** Where n goes, in words: "into pay", "↯ hop to web: Build", "back to checkout", "the end". */
export function nextText(view: StepView): string {
  const parts = nextParts(view)
  return parts === undefined ? "the end" : `${parts.how} ${parts.place}`
}
