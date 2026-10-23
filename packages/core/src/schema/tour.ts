import { z } from "zod"

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

const Note = z.object({
  question: nonEmpty,
  answer: nonEmpty,
})

const Step = z
  .object({
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
    via: Via.nullable(),
    predicted_values: z.record(z.string(), z.string()).optional(),
    calls: nonEmpty.optional(),
    trivial: z.boolean().optional(),
    uncertain: Uncertain.optional(),
    notes: z.array(Note).optional(),
  })
  .refine((s) => s.end_line >= s.start_line, {
    message: "end_line is before start_line",
    path: ["end_line"],
  })

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

type Issue = { path: (string | number)[]; message: string }

function duplicateRepoNames(tour: Tour): Issue[] {
  const seen = new Set<string>()
  return tour.repos.flatMap((r, i) => {
    if (!seen.has(r.name)) {
      seen.add(r.name)
      return []
    }
    return [{ path: ["repos", i, "name"], message: `duplicate repo name ${r.name}` }]
  })
}

function duplicateStepIds(tour: Tour): Issue[] {
  const seen = new Set<string>()
  return tour.steps.flatMap((s, i) => {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      return []
    }
    return [{ path: ["steps", i, "id"], message: `duplicate step id ${s.id}` }]
  })
}

function unknownRepos(tour: Tour): Issue[] {
  const names = new Set(tour.repos.map((r) => r.name))
  return tour.steps.flatMap((s, i) => {
    const issues: Issue[] = []
    if (!names.has(s.repo)) {
      issues.push({ path: ["steps", i, "repo"], message: `unknown repo ${s.repo}` })
    }
    s.via?.cites.forEach((c, j) => {
      if (!names.has(c.repo)) {
        issues.push({
          path: ["steps", i, "via", "cites", j, "repo"],
          message: `unknown repo ${c.repo}`,
        })
      }
    })
    return issues
  })
}

function danglingCalls(tour: Tour): Issue[] {
  const ids = new Set(tour.steps.map((s) => s.id))
  return tour.steps.flatMap((s, i) =>
    s.calls === undefined || ids.has(s.calls)
      ? []
      : [{ path: ["steps", i, "calls"], message: `calls unknown step ${s.calls}` }],
  )
}

// Every link cites its evidence: only the first step may arrive without one.
function missingEvidence(tour: Tour): Issue[] {
  return tour.steps.flatMap((s, i) =>
    i > 0 && s.via === null ? [{ path: ["steps", i, "via"], message: "missing evidence" }] : [],
  )
}

// A link that cites another repo crosses repos, so it must also cite the step's own repo,
// or admit it is a guess.
function oneSidedCrossRepoLinks(tour: Tour): Issue[] {
  return tour.steps.flatMap((s, i) => {
    if (!s.via || s.via.guessed) return []
    const cited = new Set(s.via.cites.map((c) => c.repo))
    const crosses = [...cited].some((repo) => repo !== s.repo)
    return crosses && !cited.has(s.repo)
      ? [
          {
            path: ["steps", i, "via"],
            message: `crosses repos without citing ${s.repo}: cite both sides or mark guessed`,
          },
        ]
      : []
  })
}

const tourRules = [
  duplicateRepoNames,
  duplicateStepIds,
  unknownRepos,
  danglingCalls,
  missingEvidence,
  oneSidedCrossRepoLinks,
]

export const TourSchema = TourShape.superRefine((tour, ctx) => {
  for (const rule of tourRules) {
    for (const issue of rule(tour)) ctx.addIssue({ code: "custom", ...issue })
  }
})
