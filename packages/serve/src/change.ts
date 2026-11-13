import {
  type BuildResult,
  type LogResult,
  type ResolvedChange,
  type TreksResult,
  agentSetting,
  buildChangeTrek,
  buildLogTail,
  changeFromArguments,
  ErrorCode,
  errorText,
  loadSettings,
  loadTrekEntries,
  trekStatus,
} from "@srctrek/core"
import { RequestError } from "./errors"

// Enough of a log to follow a build; the editor asks again for more.
const LOG_LINES = 200

/** The change trek's `args` name in `cwd`, as it is now. */
export async function changeNow(cwd: string, args: string[]): Promise<ResolvedChange> {
  try {
    return await changeFromArguments(cwd, args)
  } catch (error) {
    const reason = errorText(error)
    throw new RequestError(ErrorCode.unreadableChange, `can't read the change: ${reason}`)
  }
}

/** Every saved trek in `cwd`, and where the change's trek stands. */
export async function treksIn(cwd: string, args: string[]): Promise<TreksResult> {
  const change = await changeNow(cwd, args)
  const [status, treks] = await Promise.all([trekStatus(cwd, change), loadTrekEntries(cwd)])

  return { change: status, treks }
}

/** Starts the agent on the change's trek, building it or updating it when it's stale. */
export async function buildTrek(cwd: string, args: string[]): Promise<BuildResult> {
  const agent = agentSetting(await loadSettings()).command
  if (agent === undefined) {
    const message = "no agent: set one in trek's settings, or SRCTREK_AGENT"
    throw new RequestError(ErrorCode.noAgent, message)
  }

  const change = await changeNow(cwd, args)
  await buildChangeTrek(cwd, args, change, agent)

  return { change: await trekStatus(cwd, change) }
}

/** The end of the build log of the trek saved as `name`. */
export async function logOf(cwd: string, name: string, lines = LOG_LINES): Promise<LogResult> {
  return { lines: await buildLogTail(cwd, name, lines) }
}
