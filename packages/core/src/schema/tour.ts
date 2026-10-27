import { z } from "zod"
import { tourRules } from "./rules"

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
  // git blob id of the file at the tour's revision; a mismatch marks the step stale
  blob: z.string().regex(/^[0-9a-f]{40}$/),
  kind: z.enum(["call", "return", "hop", "context"]),
  changed: z.boolean(),
  summary: nonEmpty,
  details: nonEmpty,
  // the step execution came from; absent only on the first step
  from: nonEmpty.optional(),
  via: Via.nullable(),
  predicted_values: z.array(PredictedValue).optional(),
  calls: nonEmpty.optional(),
  trivial: z.boolean().optional(),
  uncertain: Uncertain.optional(),
  notes: z.array(Note).optional(),
})

// Each predicted value sits on a line of its step. A backwards range has no inside, so its
// values are left for when it's fixed.
function valuesOutsideStep(step: z.infer<typeof StepFields>, ctx: z.RefinementCtx): void {
  const { start_line: start, end_line: end } = step
  if (end < start) {
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

const Step = StepFields.refine((s) => s.end_line >= s.start_line, {
  message: "end_line is before start_line",
  path: ["end_line"],
}).superRefine(valuesOutsideStep)

const Repo = z.object({
  name: nonEmpty,
  // a local path or a remote URL
  source: nonEmpty,
  revision: nonEmpty,
  // absent for a repo on the route with no changes
  range: nonEmpty.optional(),
})

const TourShape = z.object({
  format_version: z.literal(FORMAT_VERSION),
  title: nonEmpty,
  created_at: z.iso.datetime(),
  prompt_hash: nonEmpty,
  overview: nonEmpty,
  author: z.object({
    role: z.enum(["producer", "reviewer"]),
    // absent when core built the tour itself
    agent: nonEmpty.optional(),
    model: nonEmpty,
  }),
  sources: z.array(z.object({ kind: nonEmpty, location: nonEmpty })),
  trigger: z.object({
    kind: z.enum(["request", "event", "schedule", "command"]),
    input: nonEmpty,
  }),
  outcome: nonEmpty,
  repos: z.array(Repo).min(1),
  steps: z.array(Step).min(1),
})

export type Tour = z.infer<typeof TourShape>
export type TourStep = Tour["steps"][number]

export const TourSchema = TourShape.superRefine((tour, ctx) => {
  for (const rule of tourRules) {
    for (const issue of rule(tour)) ctx.addIssue({ code: "custom", ...issue })
  }
})
