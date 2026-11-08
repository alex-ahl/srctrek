import { spawn } from "node:child_process"
import { closeSync, openSync, writeFileSync } from "node:fs"
import { mkdir, readFile, rm } from "node:fs/promises"
import { pathExists } from "../files"
import { type BuildMode, headlessBuildPrompt } from "../prompts"
import { tourPath } from "../tours"
import { type BuildFiles, buildFiles } from "./files"

/**
 * Where the agent's trek mcp appends its own lines to the build's log, each starting
 * "trek: ", next to what the agent prints.
 */
export const BUILD_LOG_ENV = "SRCTREK_BUILD_LOG"

/** How trek mcp's lines in a build log start, telling them from the agent's own output. */
export const BUILD_LOG_PREFIX = "trek: "

/** Where a background build stands: running, saved its tour, or ended without one. */
export type BuildState = "building" | "done" | "failed"

/**
 * Starts the user's agent building a tour of the change `args` names, saved as `name`, or
 * updating the one saved as `name`. The agent runs on its own, so the build goes on if trek
 * quits; its output goes to a log, and its exit code to a file when it ends.
 */
export async function startBuild(
  root: string,
  args: string[],
  name: string,
  agentCommand: string,
  mode: BuildMode = "build",
): Promise<BuildFiles> {
  const files = await buildFiles(root, name)
  await mkdir(files.dir, { recursive: true })
  await rm(files.exit, { force: true })

  // The user's command line with the instruction as its last argument, as for asking, then
  // the agent's exit code written where buildState looks for it.
  const script = `${agentCommand} "$SRCTREK_PROMPT"; echo $? > "$SRCTREK_EXIT"`
  const env = {
    ...process.env,
    SRCTREK_PROMPT: headlessBuildPrompt(args, name, mode),
    SRCTREK_EXIT: files.exit,
    [BUILD_LOG_ENV]: files.log,
  }

  // Emptied, then opened for appending, so the agent's output and trek mcp's lines, written
  // to the same file, never overwrite each other.
  writeFileSync(files.log, "")
  const log = openSync(files.log, "a")
  const agent = spawn("sh", ["-c", script], {
    cwd: root,
    env,
    stdio: ["ignore", log, log],
    detached: true,
  })
  agent.unref()
  closeSync(log)

  return files
}

/** How the build of `name` stands; undefined when it was never started here. */
export async function buildState(root: string, name: string): Promise<BuildState | undefined> {
  const files = await buildFiles(root, name)
  if (!(await pathExists(files.log))) {
    return undefined
  }

  if (!(await pathExists(files.exit))) {
    return "building"
  }

  const exitCode = (await readFile(files.exit, "utf8")).trim()
  const saved = await pathExists(tourPath(root, name))

  return exitCode === "0" && saved ? "done" : "failed"
}

/** The last `count` lines of the build's log; none when there is no log. */
export async function buildLogTail(root: string, name: string, count: number): Promise<string[]> {
  const files = await buildFiles(root, name)
  if (!(await pathExists(files.log))) {
    return []
  }

  const text = (await readFile(files.log, "utf8")).trimEnd()
  if (text === "") {
    return []
  }

  return text.split("\n").slice(-count)
}

/**
 * Whether the build's log says its tour was saved: trek mcp answers a saved tour with
 * "saved <path>". Builds from before trek mcp wrote to the log never say so.
 */
export async function buildSavedTour(root: string, name: string): Promise<boolean> {
  const files = await buildFiles(root, name)
  if (!(await pathExists(files.log))) {
    return false
  }

  const lines = (await readFile(files.log, "utf8")).split("\n")

  return lines.some((line) => line.startsWith(`${BUILD_LOG_PREFIX}saved `))
}
