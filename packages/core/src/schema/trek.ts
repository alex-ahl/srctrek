import { z } from "zod"
import { trekRules } from "./rules"

export const FORMAT_VERSION = 1

const nonEmpty = z.string().min(1)

const Citation = z.object({
  repo: nonEmpty,
  file: nonEmpty,
  line: z.number().int().positive(),
})

const Via = z.object({
  cites: z.array(Citation).min(1),
  guessed: z.boolean(),
})

const Uncertain = z.object({
  severity: z.enum(["high", "medium", "low"]),
  note: nonEmpty,
})

/** What starts a scenario: a request, an event, a schedule, or a command. */
export const TriggerKindSchema = z.enum(["request", "event", "schedule", "command"])

const PredictedValue = z.object({
  name: nonEmpty,
  value: nonEmpty,
  line: z.number().int().positive(),
  role: z.enum(["argument", "assignment", "return"]),
  // the builder doubts it; front-ends show it in the warning colour
  uncertain: z.boolean().optional(),
})

const Note = z.object({
  question: nonEmpty,
  answer: nonEmpty,
})

const StepFields = z.object({
  id: nonEmpty,
  repo: nonEmpty,
  file: nonEmpty,
  start_line: z.number().int().positive(),
  end_line: z.number().int().positive(),
  // git blob id of the file at the trek's revision; a mismatch marks the step stale
  blob: z.string().regex(/^[0-9a-f]{40}$/),
  kind: z.enum(["call", "return", "hop", "context"]),
  changed: z.boolean(),
  // the function, route, or handler the step shows, as the code names it
  name: nonEmpty.optional(),
  summary: nonEmpty,
  details: nonEmpty,
  // the step execution came from; absent on the first step and on context steps
  from: nonEmpty.optional(),
  // the step a context step explains; context steps sit outside the execution chain
  for: nonEmpty.optional(),
  via: Via.nullable(),
  predicted_values: z.array(PredictedValue).optional(),
  trivial: z.boolean().optional(),
  uncertain: Uncertain.optional(),
  notes: z.array(Note).optional(),
})

type StepLines = {
  start_line: number
  end_line: number
  predicted_values?: { name: string; line: number }[] | undefined
}

// A step's range runs forward, and each predicted value sits on one of its lines. A backwards
// range has no inside, so its values are left for when it's fixed.
function stepLineChecks(step: StepLines, ctx: z.RefinementCtx): void {
  const { start_line: start, end_line: end } = step
  if (end < start) {
    ctx.addIssue({ code: "custom", path: ["end_line"], message: "end_line is before start_line" })
    return
  }

  for (const [index, value] of (step.predicted_values ?? []).entries()) {
    if (value.line < start || value.line > end) {
      ctx.addIssue({
        code: "custom",
        path: ["predicted_values", index, "line"],
        message: `${value.name} is on line ${value.line}, outside the step's lines ${start}-${end}`,
      })
    }
  }
}

const Step = StepFields.superRefine(stepLineChecks)

/** A step as the agent submits it: everything but what core works out from git. */
export const SubmittedStepSchema = StepFields.omit({ blob: true, changed: true }).superRefine(
  stepLineChecks,
)

/**
 * What a changed repo's range ends at, as it was named when the trek was built: a pull request
 * or merge request by number, or a branch, marked when the head was a snapshot of the uncommitted
 * work on it. The range records exact commits; this says which branch to compare them with now.
 */
export const RangeHeadSchema = z.union([
  z.object({ kind: z.enum(["pull", "merge-requests"]), number: z.number().int().positive() }),
  z.object({ kind: z.literal("branch"), name: nonEmpty, uncommitted: z.boolean() }),
])

const Repo = z
  .object({
    name: nonEmpty,
    // a local path or a remote URL
    source: nonEmpty,
    revision: nonEmpty,
    // absent for a repo on the route with no changes, with its head
    range: nonEmpty.optional(),
    head: RangeHeadSchema.optional(),
  })
  .refine((repo) => (repo.range === undefined) === (repo.head === undefined), {
    message: "a repo names its head exactly when it has a range",
    path: ["head"],
  })

const TrekShape = z.object({
  format_version: z.literal(FORMAT_VERSION),
  title: nonEmpty,
  created_at: z.iso.datetime(),
  prompt_hash: nonEmpty,
  overview: nonEmpty,
  author: z.object({
    role: z.enum(["producer", "reviewer"]),
    // absent when core built the trek itself
    agent: nonEmpty.optional(),
    model: nonEmpty,
  }),
  sources: z.array(z.object({ kind: nonEmpty, location: nonEmpty })),
  trigger: z.object({
    kind: TriggerKindSchema,
    input: nonEmpty,
  }),
  outcome: nonEmpty,
  repos: z.array(Repo).min(1),
  steps: z.array(Step).min(1),
})

/** What the agent gives when it starts a trek; core adds the repos, steps, and bookkeeping. */
export const TrekHeaderSchema = TrekShape.pick({
  title: true,
  overview: true,
  trigger: true,
  outcome: true,
}).extend({
  sources: TrekShape.shape.sources.default([]),
  author: z
    .object({ agent: nonEmpty.optional(), model: nonEmpty })
    .default({ model: "unspecified" }),
})

export type TrekHeader = z.infer<typeof TrekHeaderSchema>

export type Trek = z.infer<typeof TrekShape>
export type TrekStep = Trek["steps"][number]

export const TrekSchema = TrekShape.superRefine((trek, ctx) => {
  for (const rule of trekRules) {
    for (const issue of rule(trek)) ctx.addIssue({ code: "custom", ...issue })
  }
})
