import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { z } from "zod"
import { type Trek, TrekSchema } from "../schema/trek"

export const TREKS_DIR = join(".srctrek", "treks")

export class TrekValidationError extends Error {
  constructor(
    readonly source: string,
    readonly issues: string[],
  ) {
    super(`${source} is not a valid trek:\n${issues.map((i) => `  - ${i}`).join("\n")}`)
    this.name = "TrekValidationError"
  }
}

// The id of steps[index] in raw, unvalidated data, when it has one.
function stepId(data: unknown, index: number): string | undefined {
  if (typeof data !== "object" || data === null || !("steps" in data)) {
    return undefined
  }

  const { steps } = data
  if (!Array.isArray(steps)) {
    return undefined
  }

  const step: unknown = steps[index]
  if (typeof step !== "object" || step === null || !("id" in step)) {
    return undefined
  }

  return typeof step.id === "string" ? step.id : undefined
}

// "steps.14 (s15).via": the position Zod reports, plus the step's id, which is what a
// reader knows the step by.
function describePath(path: PropertyKey[], data: unknown): string {
  if (path.length === 0) {
    return "trek"
  }

  const [head, index, ...rest] = path
  const isStepPath = head === "steps" && typeof index === "number"
  const id = isStepPath ? stepId(data, index) : undefined
  if (id === undefined) {
    return path.map(String).join(".")
  }

  return [`steps.${String(index)} (${id})`, ...rest.map(String)].join(".")
}

function describeIssues(error: z.ZodError, data: unknown): string[] {
  return error.issues.map((issue) => `${describePath(issue.path, data)}: ${issue.message}`)
}

/** Throws TrekValidationError naming `source` when `data` isn't a valid trek. */
export function parseTrek(data: unknown, source: string): Trek {
  const result = TrekSchema.safeParse(data)
  if (!result.success) {
    throw new TrekValidationError(source, describeIssues(result.error, data))
  }

  return result.data
}

function isTrekName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name)
}

function assertTrekName(name: string): void {
  if (!isTrekName(name)) {
    throw new Error(`trek name must be lowercase letters, digits and dashes: ${name}`)
  }
}

export function trekPath(root: string, name: string): string {
  assertTrekName(name)
  return join(root, TREKS_DIR, `${name}.json`)
}

/** Validates before writing, so an invalid trek never lands on disk. */
export async function saveTrek(root: string, name: string, trek: Trek): Promise<string> {
  const path = trekPath(root, name)
  parseTrek(trek, path)

  await mkdir(join(root, TREKS_DIR), { recursive: true })
  await writeFile(path, JSON.stringify(trek, null, 2) + "\n")

  return path
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    throw new TrekValidationError(path, [`not readable as JSON: ${String(error)}`])
  }
}

export async function loadTrek(path: string): Promise<Trek> {
  return parseTrek(await readJson(path), path)
}

/** A saved trek, or the first problem that keeps it from being one. */
export type LoadedTrek = Readonly<{ trek: Trek } | { problem: string }>

/** The trek saved at `path`, or its first problem when it isn't a valid trek. */
export async function loadTrekOrProblem(path: string): Promise<LoadedTrek> {
  try {
    return { trek: await loadTrek(path) }
  } catch (error) {
    if (error instanceof TrekValidationError) {
      return { problem: error.issues[0] ?? "invalid trek" }
    }

    throw error
  }
}

/** Names of saved treks under `root`, sorted; files whose names aren't trek names are skipped. */
export async function listTreks(root: string): Promise<string[]> {
  const files = await readdir(join(root, TREKS_DIR)).catch(() => [])

  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .filter(isTrekName)
    .sort()
}
