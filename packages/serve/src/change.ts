import {
  type BuildResult,
  ErrorCode,
  type LogResult,
  type ResolvedChange,
  type ToursResult,
  agentCommand,
  buildChangeTour,
  buildLogTail,
  directoryIn,
  loadTourEntries,
  readChangeArguments,
  resolveChange,
  tourStatus,
} from "@srctrek/core"
import { RequestError } from "./errors"

// Enough of a log to follow a build; the editor asks again for more.
const LOG_LINES = 200

/** The change trek's `args` name in `cwd`, as it is now. */
export async function changeNow(cwd: string, args: string[]): Promise<ResolvedChange> {
  try {
    return await resolveChange(cwd, readChangeArguments(args, directoryIn(cwd)))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new RequestError(ErrorCode.unreadableChange, `can't read the change: ${reason}`)
  }
}

/** Every saved tour in `cwd`, and where the change's tour stands. */
export async function toursIn(cwd: string, args: string[]): Promise<ToursResult> {
  const change = await changeNow(cwd, args)
  const [status, tours] = await Promise.all([tourStatus(cwd, change), loadTourEntries(cwd)])

  return { change: status, tours }
}

/** Starts the agent on the change's tour, building it or updating it when it's stale. */
export async function buildTour(cwd: string, args: string[]): Promise<BuildResult> {
  const agent = agentCommand()
  if (agent === undefined) {
    const message = "no agent: set SRCTREK_AGENT to the command that runs your agent headless"
    throw new RequestError(ErrorCode.noAgent, message)
  }

  const change = await changeNow(cwd, args)
  await buildChangeTour(cwd, args, change, agent)

  return { change: await tourStatus(cwd, change) }
}

/** The end of the build log of the tour saved as `name`. */
export async function logOf(cwd: string, name: string, lines = LOG_LINES): Promise<LogResult> {
  return { lines: await buildLogTail(cwd, name, lines) }
}
