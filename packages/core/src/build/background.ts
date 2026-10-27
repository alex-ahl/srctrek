import { spawn } from "node:child_process"
import { closeSync, openSync } from "node:fs"
import { mkdir, readFile, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathExists } from "../files"
import { runGit } from "../git/run"
import { headlessBuildPrompt } from "../prompts"
import { tourPath } from "../tours"

/** Where a background build stands: running, saved its tour, or ended without one. */
export type BuildState = "building" | "done" | "failed"

export type BuildFiles = { log: string; exit: string }

// Inside the repo's git folder, so build logs are never committed with the tours.
async function buildFiles(root: string, name: string): Promise<BuildFiles> {
  const gitDir = resolve(root, await runGit(root, ["rev-parse", "--git-common-dir"]))
  const dir = join(gitDir, "codetrail", "builds")
  await mkdir(dir, { recursive: true })

  return { log: join(dir, `${name}.log`), exit: join(dir, `${name}.exit`) }
}

/**
 * Starts the user's agent building a tour of the change `args` names, saved as `name`. The
 * agent runs on its own, so the build goes on if trail quits; its output goes to a log, and
 * its exit code to a file when it ends.
 */
export async function startBuild(
  root: string,
  args: string[],
  name: string,
  agentCommand: string,
): Promise<BuildFiles> {
  const files = await buildFiles(root, name)
  await rm(files.exit, { force: true })

  // The user's command line with the instruction as its last argument, as for asking, then
  // the agent's exit code written where buildState looks for it.
  const script = `${agentCommand} "$CODETRAIL_PROMPT"; echo $? > "$CODETRAIL_EXIT"`
  const env = {
    ...process.env,
    CODETRAIL_PROMPT: headlessBuildPrompt(args, name),
    CODETRAIL_EXIT: files.exit,
  }

  const log = openSync(files.log, "w")
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

  const lines = (await readFile(files.log, "utf8")).trimEnd().split("\n")

  return lines.slice(-count)
}
