import { readFile, writeFile } from "node:fs/promises"
import { z } from "zod"
import { type Draft, orderedSteps } from "../draft/draft"
import { SeveritySchema, StepKindSchema } from "../../schema/trek"
import { buildFiles, draftBeside } from "./files"

const DraftStepSchema = z.object({
  id: z.string(),
  repo: z.string(),
  kind: StepKindSchema,
  summary: z.string(),
  flag: SeveritySchema.nullable(),
})

const DraftFileSchema = z.object({ title: z.string(), steps: z.array(DraftStepSchema) })

/** A step of a build's draft as the build view lists it: its repo, kind, summary, and flag. */
export type DraftStep = z.infer<typeof DraftStepSchema>

/** Writes the draft's steps, in trek order, beside the build's log `log`. */
export async function writeBuildDraft(log: string, draft: Draft): Promise<void> {
  const steps = orderedSteps(draft).map(({ id, repo, kind, summary, uncertain }) => ({
    id,
    repo,
    kind,
    summary,
    flag: uncertain?.severity ?? null,
  }))

  await writeFile(draftBeside(log), JSON.stringify({ title: draft.header.title, steps }))
}

// A draft read while trek mcp writes it can be cut short: read as none, until the next look.
function parseOrNothing(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** The steps of the build of `name` so far; none before the trek starts, or without a draft. */
export async function buildDraftSteps(root: string, name: string): Promise<DraftStep[]> {
  const text = await readFile((await buildFiles(root, name)).draft, "utf8").catch(() => "")
  const parsed = DraftFileSchema.safeParse(parseOrNothing(text))
  return parsed.success ? parsed.data.steps : []
}
