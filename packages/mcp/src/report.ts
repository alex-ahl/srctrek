import { appendFile } from "node:fs/promises"
import { BUILD_LOG_ENV, BUILD_LOG_PREFIX, type Draft, writeBuildDraft } from "@srctrek/core"

/** Adds a report to the log of the build that started the agent, each of its lines marked. */
export type Report = (line: string) => Promise<void>

/**
 * Reports to the build log named in the environment, when trek started the agent; otherwise,
 * as when the user asked their agent directly, reports go nowhere. A line that can't be
 * written is dropped: the log is for watching, and must never fail the agent's work.
 */
export function reportFor(env = process.env): Report {
  const log = env[BUILD_LOG_ENV]
  if (log === undefined || log === "") {
    return async () => {}
  }

  return async (report) => {
    const lines = report.split("\n").map((line) => `${BUILD_LOG_PREFIX}${line}\n`)
    await appendFile(log, lines.join("")).catch(() => undefined)
  }
}

/** Keeps the draft so far where the build's view reads it. */
export type RecordDraft = (draft: Draft | undefined) => Promise<void>

/**
 * Writes the draft beside the log of the build that started the agent, as it changes; without
 * one, nothing. As with reports, a draft that can't be written is dropped.
 */
export function recordDraftFor(env = process.env): RecordDraft {
  const log = env[BUILD_LOG_ENV]
  if (log === undefined || log === "") {
    return async () => {}
  }

  return async (draft) => {
    if (draft !== undefined) {
      await writeBuildDraft(log, draft).catch(() => undefined)
    }
  }
}
