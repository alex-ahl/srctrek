import { appendFile } from "node:fs/promises"
import { BUILD_LOG_ENV, BUILD_LOG_PREFIX } from "@codetrail/core"

/** Adds a line to the log of the build that started the agent. */
export type Report = (line: string) => Promise<void>

/**
 * Reports to the build log named in the environment, when trail started the agent; otherwise,
 * as when the user asked their agent directly, reports go nowhere. A line that can't be
 * written is dropped: the log is for watching, and must never fail the agent's work.
 */
export function reportFor(env = process.env): Report {
  const log = env[BUILD_LOG_ENV]
  if (log === undefined || log === "") {
    return async () => {}
  }

  return async (line) => {
    await appendFile(log, `${BUILD_LOG_PREFIX}${line}\n`).catch(() => undefined)
  }
}
