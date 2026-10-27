import type { Outcome, Session } from "./session"

/** The one mutable reference: the session as the last tool call left it. */
export type SessionCell = { session: Session }

/** Runs a tool's change on the current session, keeps the session it leaves, returns its answer. */
export async function apply<T>(
  cell: SessionCell,
  change: (session: Session) => Promise<Outcome<T>>,
): Promise<T> {
  const { session, answer } = await change(cell.session)
  cell.session = session

  return answer
}
