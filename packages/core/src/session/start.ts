import type { Trek } from "../schema/trek"
import { viewContext } from "./context"
import { stepNext } from "./moves"
import { openSession } from "./session"
import { sessionView } from "./view"

/** Where a trek's first stop is: its file, in the checkout an editor opens, and its first line. */
export type StopPlace = Readonly<{ path: string; line: number }>

/**
 * The trek's first stop, for an editor that opens a file at a line without stepping. The file is
 * the user's own when it matches the trek, else the trek's copy, as stepping would show it.
 */
export async function firstStopPlace(root: string, trek: Trek): Promise<StopPlace | undefined> {
  const context = await viewContext(root, trek)
  const view = sessionView(stepNext(openSession(trek)), context)

  return view.kind === "step" ? { path: view.path, line: view.start_line } : undefined
}
