import { join } from "node:path"
import type { LineChange } from "../git/diff"
import type { Tour, TourStep } from "../schema/tour"
import { enteredFrom } from "./moves"
import { type SteppingSession, currentStep } from "./session"

/** What a view needs from outside the tour: where each repo is checked out, and git's facts. */
export type ViewContext = {
  // the folder each repo is checked out in at the tour's revision, by repo name
  readonly roots: ReadonlyMap<string, string>
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
  path: string
  start_line: number
  end_line: number
  summary: string
}

/** One frame of the call stack; `hop` marks the bottom of a stack a hop started. */
export type Frame = StepRef & { hop: boolean }

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
  // outermost first, back across every hop to the trigger; empty on a context step
  stack: Frame[]
  calls: StepRef[]
  context: StepRef[]
  notes: NonNullable<TourStep["notes"]>
}

export type OverviewView = Pick<Tour, "title" | "overview" | "trigger" | "outcome"> & {
  kind: "overview"
  count: number
}

export type EndView = Pick<Tour, "title" | "outcome"> & { kind: "end"; count: number }

/** What a front-end draws for the session as it stands, ready to render. */
export type SessionView = OverviewView | StepView | EndView

function refOf(step: TourStep, context: ViewContext): StepRef {
  const root = context.roots.get(step.repo) ?? ""

  return {
    id: step.id,
    repo: step.repo,
    file: step.file,
    path: join(root, step.file),
    start_line: step.start_line,
    end_line: step.end_line,
    summary: step.summary,
  }
}

// Every frame under the step, back across every hop to the trigger: how execution got here.
function framesOf(session: SteppingSession, step: TourStep, context: ViewContext): Frame[] {
  const { stacks, beneath } = session.stacks
  const byId = new Map(session.tour.steps.map((s) => [s.id, s]))

  const chain = (id: string): string[] => {
    const below = beneath.get(id)
    return [...(below === undefined ? [] : chain(below)), ...(stacks.get(id) ?? [])]
  }

  return chain(step.id).flatMap((id) => {
    const frame = byId.get(id)
    return frame === undefined ? [] : [{ ...refOf(frame, context), hop: frame.kind === "hop" }]
  })
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
    stack: framesOf(session, step, context),
    calls: enteredFrom(session, step).map(ref),
    context: steps.filter((s) => s.kind === "context" && s.for === step.id).map(ref),
    notes: step.notes ?? [],
  }
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
    return { kind: "end", title: tour.title, outcome: tour.outcome, count }
  }

  const { title, overview, trigger, outcome } = tour

  return { kind: "overview", title, overview, trigger, outcome, count }
}
