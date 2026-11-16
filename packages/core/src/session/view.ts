import { join } from "node:path"
import type { LineChange } from "../git/diff"
import { flagCounts } from "../schema/flags"
import type { Severity, Trek, TrekStep } from "../schema/trek"
import { enteredFrom, stepNext } from "./moves"
import { type SteppingSession, currentStep } from "./session"

/** The user's own checkout of a repo, and the files the trek visits that are the same there. */
export type OwnCheckout = { readonly root: string; readonly files: ReadonlySet<string> }

/** What a view needs from outside the trek: where each repo is checked out, and git's facts. */
export type ViewContext = {
  // the folder each repo is checked out in at the trek's revision, by repo name
  readonly roots: ReadonlyMap<string, string>
  // the user's own checkout of each repo that has one, by repo name
  readonly own: ReadonlyMap<string, OwnCheckout>
  // the lines the change touches, by repo and file
  readonly changedLines: ReadonlyMap<string, ReadonlyMap<string, ReadonlyMap<number, LineChange>>>
  // the steps whose file differs now from the version the trek describes
  readonly stale: ReadonlySet<string>
}

/** A step named where the view points at it: a frame, a call to step into, a context step. */
export type StepRef = {
  id: string
  repo: string
  file: string
  // the user's own file when it's the trek's version, else the trek's copy of it
  path: string
  trek_copy: boolean
  // where the file lives in the user's checkout, even when `path` is the trek's copy; null for a
  // repo the user has no checkout of
  own_path: string | null
  start_line: number
  end_line: number
  // the function, route, or handler the step shows; null when the trek doesn't name it
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

/**
 * Where next leads from a step: into one of its calls (`line` makes it), across a hop it starts,
 * back to a caller, on to another step, or to the end of the trek (`to` null).
 */
export type NextStop = {
  how: "into" | "hop" | "back" | "on" | "end"
  to: StepRef | null
  line: number | null
}

/** One frame of the call stack; `hop` marks the bottom of a stack a hop started. */
export type Frame = StepRef & { hop: boolean }

/**
 * A step the current one enters; `call_line` is the line in the current step that makes the
 * call, from the evidence the entered step cites, or null when it cites none there; `guessed`
 * marks a link matched only by name.
 */
export type Call = StepRef & { call_line: number | null; guessed: boolean }

export type StepView = StepRef & {
  kind: "step"
  number: number
  count: number
  step_kind: TrekStep["kind"]
  details: string
  changed: boolean
  stale: boolean
  changed_lines: { line: number; change: LineChange }[]
  flag: TrekStep["uncertain"] | null
  predicted_values: NonNullable<TrekStep["predicted_values"]>
  // outermost first, back across every hop whose caller waits for it; empty on a context step
  stack: Frame[]
  // what started this stack when it begins at a hop nobody waits on, such as a queued message
  started_by: StepRef | null
  calls: Call[]
  context: StepRef[]
  notes: NonNullable<TrekStep["notes"]>
  // null for the first step, which came from the trigger
  came_from: CameFrom | null
  next: NextStop
}

export type OverviewView = Pick<Trek, "title" | "overview" | "trigger" | "outcome"> & {
  kind: "overview"
  count: number
  // the repos the trek goes through, by name
  repos: string[]
  // how many steps carry a flag of each severity
  flags: Record<Severity, number>
}

/** A flagged step, for the end of a trek: its stop number and what its flag says. */
export type FlaggedStep = StepRef & { number: number } & NonNullable<TrekStep["uncertain"]>

export type EndView = Pick<Trek, "title" | "outcome"> & {
  kind: "end"
  count: number
  // every flag in the trek, most severe first, then in trek order
  flags: FlaggedStep[]
}

/** What a front-end draws for the session as it stands, ready to render. */
export type SessionView = OverviewView | StepView | EndView

// Where the editor opens a file: the user's own when it's the trek's version, else the trek's
// copy.
function placeOf(repo: string, file: string, context: ViewContext) {
  const own = context.own.get(repo)
  const isOwn = own?.files.has(file) === true
  const root = isOwn ? own.root : (context.roots.get(repo) ?? "")

  return {
    path: join(root, file),
    trek_copy: !isOwn,
    own_path: own === undefined ? null : join(own.root, file),
  }
}

function refOf(step: TrekStep, context: ViewContext): StepRef {
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
  step: TrekStep,
  context: ViewContext,
): { stack: Frame[]; started_by: StepRef | null } {
  const { stacks, beneath, answeredHops } = session.stacks
  const byId = new Map(session.trek.steps.map((s) => [s.id, s]))

  type Chain = { frames: readonly string[]; startedBy: string | undefined }
  const chain = (id: string): Chain => {
    const frames = stacks.get(id) ?? []
    const below = beneath.get(id)
    if (below === undefined) {
      return { frames, startedBy: undefined }
    }

    const hop = frames[0]
    if (hop !== undefined && !answeredHops.has(hop)) {
      return { frames, startedBy: below }
    }

    const under = chain(below)
    return { frames: [...under.frames, ...frames], startedBy: under.startedBy }
  }

  const { frames, startedBy } = chain(step.id)
  const stack = frames.flatMap((id) => {
    const frame = byId.get(id)
    return frame === undefined ? [] : [{ ...refOf(frame, context), hop: frame.kind === "hop" }]
  })
  const cause = startedBy === undefined ? undefined : byId.get(startedBy)

  return { stack, started_by: cause === undefined ? null : refOf(cause, context) }
}

// The step's place among the stops, the executed steps; a context step takes the place of the
// step it explains.
function stopNumber(session: SteppingSession, step: TrekStep): number {
  const { steps } = session.trek
  const stop = step.kind === "context" ? steps.find((s) => s.id === step.for) : step
  const upTo = steps.slice(0, stop === undefined ? 0 : steps.indexOf(stop) + 1)

  return upTo.filter((s) => session.executed.has(s.id)).length
}

function changedLinesOf(step: TrekStep, context: ViewContext): StepView["changed_lines"] {
  const lines = context.changedLines.get(step.repo)?.get(step.file) ?? new Map<number, LineChange>()

  return [...lines].map(([line, change]) => ({ line, change }))
}

// The line of `step` that the evidence for entering `entered` points at.
function callLine(step: TrekStep, entered: TrekStep): number | null {
  const inStep = (cite: { repo: string; file: string; line: number }) =>
    cite.repo === step.repo &&
    cite.file === step.file &&
    cite.line >= step.start_line &&
    cite.line <= step.end_line

  return entered.via?.cites.find(inStep)?.line ?? null
}

function cameFrom(session: SteppingSession, step: TrekStep, context: ViewContext): CameFrom | null {
  const relation = step.kind === "context" ? "for" : "from"
  const earlier = session.trek.steps.find((s) => s.id === step[relation])
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

function howNextLeaves(step: TrekStep, next: TrekStep): NextStop["how"] {
  if (next.kind === "return") {
    return "back"
  }
  if (next.from !== step.id) {
    return "on"
  }
  return next.kind === "hop" ? "hop" : "into"
}

function nextOf(session: SteppingSession, step: TrekStep, context: ViewContext): NextStop {
  const next = currentStep(stepNext(session))
  if (next === undefined) {
    return { how: "end", to: null, line: null }
  }

  const how = howNextLeaves(step, next)
  const line = how === "into" || how === "hop" ? callLine(step, next) : null

  return { how, to: refOf(next, context), line }
}

function stepView(session: SteppingSession, step: TrekStep, context: ViewContext): StepView {
  const { steps } = session.trek
  const ref = (s: TrekStep) => refOf(s, context)

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
      guessed: entered.via?.guessed ?? false,
    })),
    context: steps.filter((s) => s.kind === "context" && s.for === step.id).map(ref),
    notes: step.notes ?? [],
    came_from: cameFrom(session, step, context),
    next: nextOf(session, step, context),
  }
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

function flagsOf(session: SteppingSession, context: ViewContext): FlaggedStep[] {
  const flagged = session.trek.steps.flatMap((step) =>
    step.uncertain === undefined
      ? []
      : [{ ...refOf(step, context), number: stopNumber(session, step), ...step.uncertain }],
  )

  // a stable sort, so steps of one severity stay in trek order
  return flagged.toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

/** The view of the session as it stands: its overview, its current step, or its end. */
export function sessionView(session: SteppingSession, context: ViewContext): SessionView {
  const { trek } = session
  const count = session.executed.size
  const step = currentStep(session)
  if (step !== undefined) {
    return stepView(session, step, context)
  }

  if (session.at.kind === "end") {
    return {
      kind: "end",
      title: trek.title,
      outcome: trek.outcome,
      count,
      flags: flagsOf(session, context),
    }
  }

  const { title, overview, trigger, outcome } = trek
  const repos = trek.repos.map((repo) => repo.name)
  const flags = flagCounts(trek.steps)

  return { kind: "overview", title, overview, trigger, outcome, count, repos, flags }
}
