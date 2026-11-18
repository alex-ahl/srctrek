import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathExists } from "../../files"
import { type BuildState, buildState } from "./background"
import { type DraftStep, readDraftSteps } from "./draft-file"
import { type BuildFiles, buildFiles } from "./files"
import { buildProgress } from "./progress"

// The builds kept per trek besides the latest; older ones go as new ones start.
const KEPT = 10

/** One of a trek's builds: the latest, or one kept from before, and where its files are. */
export type BuildRef = Readonly<{ files: BuildFiles; latest: boolean }>

/** A build as its files tell it: its log, its draft's steps, how it stands, and its clock. */
export type BuildRecord = Readonly<{
  log: readonly string[]
  steps: readonly DraftStep[]
  state: BuildState | undefined
  started: Date | undefined
  ended: Date | undefined
}>

const historyOf = (files: BuildFiles, name: string) => join(files.dir, "history", name)

function keptFiles(dir: string): BuildFiles {
  return {
    dir,
    log: join(dir, "build.log"),
    exit: join(dir, "build.exit"),
    pid: join(dir, "build.pid"),
    draft: join(dir, "build.draft.json"),
  }
}

// "2026-11-17T09-41-07": when the build started, sortable, and a folder name on any system.
const folderFor = (started: Date) => started.toISOString().slice(0, 19).replaceAll(":", "-")

async function moveIfThere(from: string, to: string): Promise<void> {
  if (await pathExists(from)) {
    await rename(from, to)
  }
}

// The kept builds' folders, newest first.
async function keptFolders(history: string): Promise<string[]> {
  const folders = await readdir(history).catch(() => [])
  return folders.toSorted((a, b) => b.localeCompare(a))
}

/**
 * Moves the latest build of `name` into its history, as a new one starts, and drops the oldest
 * past the ones kept. A build that never said how it ended was replaced: it's kept as ended.
 */
export async function keepBuild(files: BuildFiles, name: string): Promise<void> {
  if (!(await pathExists(files.log))) {
    return
  }

  const started = (await stat(files.pid).catch(() => stat(files.log))).mtime
  const history = historyOf(files, name)
  const kept = keptFiles(join(history, folderFor(started)))
  await mkdir(kept.dir, { recursive: true })
  if (!(await pathExists(files.exit))) {
    await writeFile(files.exit, "replaced\n")
  }

  await moveIfThere(files.log, kept.log)
  await moveIfThere(files.exit, kept.exit)
  await moveIfThere(files.pid, kept.pid)
  await moveIfThere(files.draft, kept.draft)

  const past = (await keptFolders(history)).slice(KEPT)
  await Promise.all(past.map((folder) => rm(join(history, folder), { recursive: true })))
}

/** The builds of `name`, newest first: the latest, then those kept from before. */
export async function buildHistory(root: string, name: string): Promise<BuildRef[]> {
  const files = await buildFiles(root, name)
  const history = historyOf(files, name)
  const latest = (await pathExists(files.log)) ? [{ files, latest: true }] : []
  const kept = (await keptFolders(history)).map((folder) => ({
    files: keptFiles(join(history, folder)),
    latest: false,
  }))

  return [...latest, ...kept]
}

// A kept build ended: saved when its agent ended well and trek mcp said it saved the trek.
async function keptState(files: BuildFiles, log: readonly string[]): Promise<BuildState> {
  const exit = (await readFile(files.exit, "utf8").catch(() => "")).trim()
  return exit === "0" && buildProgress(log).saved ? "done" : "failed"
}

/** A build of `name` as its files tell it; the latest stands as `buildState` says. */
export async function readBuild(root: string, name: string, build: BuildRef): Promise<BuildRecord> {
  const { files } = build
  const text = await readFile(files.log, "utf8").catch(() => "")
  const log = text === "" ? [] : text.trimEnd().split("\n")
  const timeOf = async (path: string) => (await stat(path).catch(() => undefined))?.mtime

  const [steps, state, started, ended] = await Promise.all([
    readDraftSteps(files.draft),
    build.latest ? buildState(root, name) : keptState(files, log),
    timeOf(files.pid),
    timeOf(files.exit),
  ])

  return { log, steps, state, started, ended }
}
