import { join } from "node:path"
import type { LineChange } from "../git/diff"
import type { Tour, TourStep } from "../schema/tour"
import { enteredFrom } from "./moves"
import { type SteppingSession, currentStep } from "./session"

/** The user's own checkout of a repo, and the files the tour visits that are the same there. */
export type OwnCheckout = { readonly root: string; readonly files: ReadonlySet<string> }

/** What a view needs from outside the tour: where each repo is checked out, and git's facts. */
export type ViewContext = {
  // the folder each repo is checked out in at the tour's revision, by repo name
  readonly roots: ReadonlyMap<string, string>
  // the user's own checkout of each repo that has one, by repo name
  readonly own: ReadonlyMap<string, OwnCheckout>
  // the lines the change touches, by repo and file
  readonly changedLines: ReadonlyMap<string, ReadonlyMap<string, ReadonlyMap<number, LineChange>>>
  // the steps whose file differs now from the version the tour describes
  readonly stale: ReadonlySet<string>
}

/** A step named where the view points at it: a frame, a call to step into, a context step. */
export type StepRef = {
  id: string
  repo: string
  file: string
  // the user's own file when it's the tour's version, else the tour's copy of it
  path: string
  tour_copy: boolean
  // where the file lives in the user's checkout, even when `path` is the tour's copy; null for a
  // repo the user has no checkout of
  own_path: string | null
  start_line: number
  end_line: number
  // the function, route, or handler the step shows; null when the tour doesn't name it
  name: string | null
  summary: string
}

/** A line the evidence for a link points at, with where the editor opens it. */
export type Cite = { repo: string; file: string; line: number; path: string }

/**
 * The step a step came from (`from`), or that a context step explains (`for`), with its stop
 * number and the link's evidence; `guessed` marks a link matched only by name.
 */
export type CameFrom = StepRef & {
  relation: "from" | "for"
  number: number
  guessed: boolean
  cites: Cite[]
}

/** One frame of the call stack; `hop` marks the bottom of a stack a hop started. */
export type Frame = StepRef & { hop: boolean }

/**
 * A step the current one enters; `call_line` is the line in the current step that makes the
 * call, from the evidence the entered step cites, or null when it cites none there.
 */
export type Call = StepRef & { call_line: number | null }

export type StepView = StepRef & {
  kind: "step"
  number: number
  count: number
  step_kind: TourStep["kind"]
  details: string
  changed: boolean
  stale: boolean
  changed_lines: { line: number; change: LineChange }[]
  flag: TourStep["uncertain"] | null
  predicted_values: NonNullable<TourStep["predicted_values"]>
  // outermost first, back across every hop whose caller waits for it; empty on a context step
  stack: Frame[]
  // what started this stack when it begins at a hop nobody waits on, such as a queued message
  started_by: StepRef | null
  calls: Call[]
  context: StepRef[]
  notes: NonNullable<TourStep["notes"]>
  // null for the first step, which came from the trigger
  came_from: CameFrom | null
}

export type OverviewView = Pick<Tour, "title" | "overview" | "trigger" | "outcome"> & {
  kind: "overview"
  count: number
  // the repos the tour goes through, by name
  repos: string[]
  // how many steps carry a flag of each severity
  flags: Record<NonNullable<TourStep["uncertain"]>["severity"], number>
}

/** A flagged step, for the end of a tour: its stop number and what its flag says. */
export type FlaggedStep = StepRef & { number: number } & NonNullable<TourStep["uncertain"]>

export type EndView = Pick<Tour, "title" | "outcome"> & {
  kind: "end"
  count: number
  // every flag in the tour, most severe first, then in tour order
  flags: FlaggedStep[]
}

/** What a front-end draws for the session as it stands, ready to render. */
export type SessionView = OverviewView | StepView | EndView

// Where the editor opens a file: the user's own when it's the tour's version, else the tour's
// copy.
function placeOf(repo: string, file: string, context: ViewContext) {
  const own = context.own.get(repo)
  const isOwn = own?.files.has(file) === true
  const root = isOwn ? own.root : (context.roots.get(repo) ?? "")

  return {
    path: join(root, file),
    tour_copy: !isOwn,
    own_path: own === undefined ? null : join(own.root, file),
  }
}

function refOf(step: TourStep, context: ViewContext): StepRef {
  return {
    id: step.id,
    repo: step.repo,
    file: step.file,
    ...placeOf(step.repo, step.file, context),
    start_line: step.start_line,
    end_line: step.end_line,
    name: step.name ?? null,
    summary: step.summary,
  }
}

// The frames running at the step: its own stack, and the stacks beneath it back across every hop
// whose caller waits for its answer, such as a request. A hop nobody waits on (a queued message,
// an event) runs on its own, so the frames end there and `started_by` names its cause instead.
function framesOf(
  session: SteppingSession,
  step: TourStep,
  context: ViewContext,
): { stack: Frame[]; started_by: StepRef | null } {
  const { stacks, beneath, answeredHops } = session.stacks
  const byId = new Map(session.tour.steps.map((s) => [s.id, s]))
  let startedBy: string | undefined

  const chain = (id: string): readonly string[] => {
    const frames = stacks.get(id) ?? []
    const below = beneath.get(id)
    const hop = frames[0]
    if (below !== undefined && hop !== undefined && !answeredHops.has(hop)) {
      startedBy = below
      return frames
    }
    return [...(below === undefined ? [] : chain(below)), ...frames]
  }

  const stack = chain(step.id).flatMap((id) => {
    const frame = byId.get(id)
    return frame === undefined ? [] : [{ ...refOf(frame, context), hop: frame.kind === "hop" }]
  })
  const cause = startedBy === undefined ? undefined : byId.get(startedBy)

  return { stack, started_by: cause === undefined ? null : refOf(cause, context) }
}

// The step's place among the stops, the executed steps; a context step takes the place of the
// step it explains.
function stopNumber(session: SteppingSession, step: TourStep): number {
  const { steps } = session.tour
  const stop = step.kind === "context" ? steps.find((s) => s.id === step.for) : step
  const upTo = steps.slice(0, stop === undefined ? 0 : steps.indexOf(stop) + 1)

  return upTo.filter((s) => session.executed.has(s.id)).length
}

function changedLinesOf(step: TourStep, context: ViewContext): StepView["changed_lines"] {
  const lines = context.changedLines.get(step.repo)?.get(step.file) ?? new Map<number, LineChange>()

  return [...lines].map(([line, change]) => ({ line, change }))
}

// The line of `step` that the evidence for entering `entered` points at.
function callLine(step: TourStep, entered: TourStep): number | null {
  const inStep = (cite: { repo: string; file: string; line: number }) =>
    cite.repo === step.repo &&
    cite.file === step.file &&
    cite.line >= step.start_line &&
    cite.line <= step.end_line

  return entered.via?.cites.find(inStep)?.line ?? null
}

function cameFrom(session: SteppingSession, step: TourStep, context: ViewContext): CameFrom | null {
  const relation = step.kind === "context" ? "for" : "from"
  const earlier = session.tour.steps.find((s) => s.id === step[relation])
  if (earlier === undefined) {
    return null
  }

  const cites = (step.via?.cites ?? []).map((cite) => ({
    ...cite,
    path: placeOf(cite.repo, cite.file, context).path,
  }))

  return {
    ...refOf(earlier, context),
    relation,
    number: stopNumber(session, earlier),
    guessed: step.via?.guessed ?? false,
    cites,
  }
}

function stepView(session: SteppingSession, step: TourStep, context: ViewContext): StepView {
  const { steps } = session.tour
  const ref = (s: TourStep) => refOf(s, context)

  return {
    ...ref(step),
    kind: "step",
    number: stopNumber(session, step),
    count: session.executed.size,
    step_kind: step.kind,
    details: step.details,
    changed: step.changed,
    stale: context.stale.has(step.id),
    changed_lines: changedLinesOf(step, context),
    flag: step.uncertain ?? null,
    predicted_values: step.predicted_values ?? [],
    ...framesOf(session, step, context),
    calls: enteredFrom(session, step).map((entered) => ({
      ...ref(entered),
      call_line: callLine(step, entered),
    })),
    context: steps.filter((s) => s.kind === "context" && s.for === step.id).map(ref),
    notes: step.notes ?? [],
    came_from: cameFrom(session, step, context),
  }
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

function flagsOf(session: SteppingSession, context: ViewContext): FlaggedStep[] {
  const flagged = session.tour.steps.flatMap((step) =>
    step.uncertain === undefined
      ? []
      : [{ ...refOf(step, context), number: stopNumber(session, step), ...step.uncertain }],
  )

  // a stable sort, so steps of one severity stay in tour order
  return flagged.toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

/** The view of the session as it stands: its overview, its current step, or its end. */
export function sessionView(session: SteppingSession, context: ViewContext): SessionView {
  const { tour } = session
  const count = session.executed.size
  const step = currentStep(session)
  if (step !== undefined) {
    return stepView(session, step, context)
  }

  if (session.at.kind === "end") {
    return {
      kind: "end",
      title: tour.title,
      outcome: tour.outcome,
      count,
      flags: flagsOf(session, context),
    }
  }

  const { title, overview, trigger, outcome } = tour
  const repos = tour.repos.map((repo) => repo.name)
  const severityCount = (severity: string) =>
    tour.steps.filter((s) => s.uncertain?.severity === severity).length
  const flags = {
    high: severityCount("high"),
    medium: severityCount("medium"),
    low: severityCount("low"),
  }

  return { kind: "overview", title, overview, trigger, outcome, count, repos, flags }
}
