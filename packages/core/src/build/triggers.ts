import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import type { ResolvedChange } from "../change/resolve"
import { pathExists } from "../files"
import { TriggerKindSchema } from "../schema/trek"
import { placeProblem } from "./draft/citations"

/**
 * A way the code is used, found by the agent: its kind, a name in the user's words (what
 * `--code="…"` takes), and the line that proves it, such as a route or a handler's
 * registration.
 */
export const TriggerSchema = z.object({
  kind: TriggerKindSchema,
  name: z.string().min(1),
  evidence: z.object({
    repo: z.string().min(1),
    file: z.string().min(1),
    line: z.number().int().positive(),
  }),
})

export type Trigger = z.infer<typeof TriggerSchema>

// The triggers found, with the revisions they were found at.
const FoundTriggersSchema = z.object({
  repos: z.array(z.object({ name: z.string(), revision: z.string() })),
  triggers: z.array(TriggerSchema),
})

const TRIGGERS_DIR = join(".srctrek", "triggers")

/** Where the triggers found under `name` are saved. */
export function triggersPath(root: string, name: string): string {
  return join(root, TRIGGERS_DIR, `${name}.json`)
}

/** Each trigger whose evidence doesn't exist at its repo's revision, or is blank. */
export async function triggerProblems(
  change: ResolvedChange,
  triggers: Trigger[],
): Promise<string[]> {
  const problemOf = async (trigger: Trigger) => {
    const problem = await placeProblem(change, { ...trigger.evidence, how: "cites" })
    return problem === undefined ? undefined : `${trigger.name}: ${problem}`
  }
  const problems = await Promise.all(triggers.map(problemOf))

  return problems.filter((problem) => problem !== undefined)
}

/** Saves the triggers found in the change's repos, with the revisions they were found at. */
export async function saveTriggers(
  root: string,
  name: string,
  change: ResolvedChange,
  triggers: Trigger[],
): Promise<string> {
  const repos = change.repos.map((repo) => ({ name: repo.name, revision: repo.revision }))
  const path = triggersPath(root, name)
  await mkdir(join(root, TRIGGERS_DIR), { recursive: true })
  await writeFile(path, JSON.stringify({ repos, triggers }, null, 2) + "\n")

  return path
}

// A file that isn't valid JSON, or not this shape, holds no triggers worth showing.
async function readFound(path: string): Promise<z.infer<typeof FoundTriggersSchema> | undefined> {
  try {
    const parsed = FoundTriggersSchema.safeParse(JSON.parse(await readFile(path, "utf8")))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

/**
 * The triggers saved as `name`, while every repo they were found in is still at the same
 * revision; none when there are none, or the code has moved on.
 */
export async function loadTriggers(
  root: string,
  name: string,
  change: ResolvedChange,
): Promise<Trigger[] | undefined> {
  const path = triggersPath(root, name)
  if (!(await pathExists(path))) {
    return undefined
  }

  const found = await readFound(path)
  const revisionNow = (repo: string) => change.repos.find((r) => r.name === repo)?.revision
  const current = found?.repos.every((repo) => revisionNow(repo.name) === repo.revision)

  return current === true ? found?.triggers : undefined
}
