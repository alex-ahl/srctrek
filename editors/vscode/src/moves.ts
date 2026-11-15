import type { SessionView } from "@srctrek/core"
import type { Move } from "./client"

/** Whether a move left the trek where it was, which the server answers with the same view. */
export function sameView(before: SessionView, after: SessionView): boolean {
  if (before.kind === "step" && after.kind === "step") {
    return before.id === after.id
  }
  return before.kind === after.kind
}

export const NOWHERE: Record<Move, string> = {
  next: "the trek ends here",
  prev: "this is the start of the trek",
  into: "nothing to step into here",
  over: "nothing to step over here",
  out: "nothing to step out to",
  goto: "already there",
}
