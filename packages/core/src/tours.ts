import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { z } from "zod"
import { type Tour, TourSchema } from "./schema/tour"

export const TOURS_DIR = join(".codetrail", "tours")

export class TourValidationError extends Error {
  constructor(
    readonly source: string,
    readonly issues: string[],
  ) {
    super(`${source} is not a valid tour:\n${issues.map((i) => `  - ${i}`).join("\n")}`)
    this.name = "TourValidationError"
  }
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "tour"
    return `${where}: ${issue.message}`
  })
}

/** Throws TourValidationError naming `source` when `data` isn't a valid tour. */
export function parseTour(data: unknown, source: string): Tour {
  const result = TourSchema.safeParse(data)
  if (!result.success) throw new TourValidationError(source, describeIssues(result.error))
  return result.data
}

function isTourName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name)
}

function assertTourName(name: string): void {
  if (!isTourName(name)) {
    throw new Error(`tour name must be lowercase letters, digits and dashes: ${name}`)
  }
}

export function tourPath(root: string, name: string): string {
  assertTourName(name)
  return join(root, TOURS_DIR, `${name}.json`)
}

/** Validates before writing, so an invalid tour never lands on disk. */
export async function saveTour(root: string, name: string, tour: Tour): Promise<string> {
  const path = tourPath(root, name)
  parseTour(tour, path)
  await mkdir(join(root, TOURS_DIR), { recursive: true })
  await writeFile(path, JSON.stringify(tour, null, 2) + "\n")
  return path
}

export async function loadTour(path: string): Promise<Tour> {
  let data: unknown
  try {
    data = JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    throw new TourValidationError(path, [`not readable as JSON: ${String(error)}`])
  }
  return parseTour(data, path)
}

/** Names of saved tours under `root`, sorted; files whose names aren't tour names are skipped. */
export async function listTours(root: string): Promise<string[]> {
  const files = await readdir(join(root, TOURS_DIR)).catch(() => [])
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .filter(isTourName)
    .sort()
}
