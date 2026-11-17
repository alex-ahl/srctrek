import { stat } from "node:fs/promises"
import { BUILD_LOG_PREFIX } from "./background"
import { buildFiles } from "./files"

/**
 * How far a build has got, as its log tells it: what the agent read (newest last), the trek's
 * title once started, its steps so far, the problems of each round trek mcp turned away, whether
 * the trek was saved, and whether the user stopped it.
 */
export type BuildProgress = Readonly<{
  reads: readonly string[]
  title: string | undefined
  steps: readonly string[]
  rejected: readonly (readonly string[])[]
  saved: boolean
  stopped: boolean
}>

const NOTHING: BuildProgress = {
  reads: [],
  title: undefined,
  steps: [],
  rejected: [],
  saved: false,
  stopped: false,
}

const STARTED = /^started "(.*)": /
const TREK_HAS = /; the trek has (.*)$/
const REJECTED = "nothing was added:"

// One of trek mcp's lines read into the progress so far; undefined for a line of no kind of its
// own, such as one of a rejected round's problems, which each follow its first line.
function withLine(progress: BuildProgress, line: string): BuildProgress | undefined {
  const started = STARTED.exec(line)
  const has = TREK_HAS.exec(line)
  if (line === REJECTED) {
    return { ...progress, rejected: [...progress.rejected, []] }
  }

  if (line.includes(" → ") || line.startsWith("opened ")) {
    return { ...progress, reads: [...progress.reads, line] }
  }

  if (started !== null) {
    return { ...progress, title: started[1] }
  }

  if (has !== null) {
    return { ...progress, steps: (has[1] ?? "").split(", ") }
  }

  if (line.startsWith("saved ")) {
    return { ...progress, saved: true }
  }

  return line === "stopped" ? { ...progress, stopped: true } : undefined
}

function withProblem(progress: BuildProgress, problem: string): BuildProgress {
  const rounds = progress.rejected.slice(0, -1)
  const last = progress.rejected.at(-1) ?? []
  return { ...progress, rejected: [...rounds, [...last, problem]] }
}

type Reading = Readonly<{ progress: BuildProgress; rejecting: boolean }>

// A line of no kind of its own is a problem of the round rejected just before it, else nothing.
function read({ progress, rejecting }: Reading, line: string): Reading {
  const next = withLine(progress, line)
  if (next !== undefined) {
    return { progress: next, rejecting: line === REJECTED }
  }

  return { progress: rejecting && line !== "" ? withProblem(progress, line) : progress, rejecting }
}

/** A build's progress from its log's lines: trek mcp's own, marked `trek: `; the agent's are left. */
export function buildProgress(log: readonly string[]): BuildProgress {
  const marked = log.flatMap((line) =>
    line.startsWith(BUILD_LOG_PREFIX) ? [line.slice(BUILD_LOG_PREFIX.length)] : [],
  )

  return marked.reduce(read, { progress: NOTHING, rejecting: false }).progress
}

/** When the build of `name` started and, once it has, ended: none for a build never started. */
export async function buildTimes(
  root: string,
  name: string,
): Promise<Readonly<{ started: Date | undefined; ended: Date | undefined }>> {
  const files = await buildFiles(root, name)
  const timeOf = async (path: string) => (await stat(path).catch(() => undefined))?.mtime

  // the process file is written once, as the build starts; the exit code once, as it ends
  return { started: await timeOf(files.pid), ended: await timeOf(files.exit) }
}
