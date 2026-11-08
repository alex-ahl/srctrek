import type { TrekStep } from "../schema/trek"
import { type SteppingSession, currentStep } from "./session"

// The session's place in trek order: -1 at the overview, the step count at the end.
function indexOf(session: SteppingSession): number {
  const { at, trek } = session
  if (at.kind === "overview") {
    return -1
  }

  return at.kind === "step" ? at.index : trek.steps.length
}

// The session on the step at `index`, or at the end past the last.
function moveTo(session: SteppingSession, index: number): SteppingSession {
  const step = session.trek.steps[index]
  if (step === undefined) {
    return { ...session, at: { kind: "end" } }
  }

  const visited = new Set([...session.visited, step.id])

  return { ...session, at: { kind: "step", index }, visited }
}

// The first executed step after the current one that `stops` accepts, else the end.
function nextWhere(session: SteppingSession, stops: (step: TrekStep) => boolean): SteppingSession {
  const from = indexOf(session)
  const isStop = (step: TrekStep, index: number) =>
    index > from && session.executed.has(step.id) && stops(step)
  const index = session.trek.steps.findIndex(isStop)

  return moveTo(session, index < 0 ? session.trek.steps.length : index)
}

// The executed step the session is on; over, out, and into start only from one.
function executedStep(session: SteppingSession): TrekStep | undefined {
  const step = currentStep(session)
  return step !== undefined && session.executed.has(step.id) ? step : undefined
}

/**
 * The next executed step in trek order; past the last, the end. Context steps are passed over:
 * the step they explain offers them.
 */
export function stepNext(session: SteppingSession): SteppingSession {
  return session.at.kind === "end" ? session : nextWhere(session, () => true)
}

/** The executed step before in trek order; before the first, the overview. */
export function stepBack(session: SteppingSession): SteppingSession {
  const from = indexOf(session)
  const isEarlier = (step: TrekStep, index: number) => index < from && session.executed.has(step.id)
  const index = session.trek.steps.findLastIndex(isEarlier)

  return index < 0 ? { ...session, at: { kind: "overview" } } : moveTo(session, index)
}

/** The step with `id`; the session as it was when the trek has none. */
export function stepTo(session: SteppingSession, id: string): SteppingSession {
  const index = session.trek.steps.findIndex((step) => step.id === id)

  return index < 0 ? session : moveTo(session, index)
}

/** The steps execution enters from `step`: its calls and the hops it starts, in trek order. */
export function enteredFrom(session: SteppingSession, step: TrekStep): TrekStep[] {
  const isEntered = (later: TrekStep) =>
    later.from === step.id && (later.kind === "call" || later.kind === "hop")

  return session.trek.steps.filter((later) => session.executed.has(later.id) && isEntered(later))
}

/**
 * Into `target`, one of the steps entered from the current step; without one, into the first
 * not yet visited, else the first. The session as it was when there's nothing to enter.
 */
export function stepInto(session: SteppingSession, target?: string): SteppingSession {
  const step = executedStep(session)
  const entered = step === undefined ? [] : enteredFrom(session, step)
  const unvisited = entered.find((later) => !session.visited.has(later.id))
  const chosen =
    target === undefined ? (unvisited ?? entered[0]) : entered.find((later) => later.id === target)

  return chosen === undefined ? session : stepTo(session, chosen.id)
}

/** The next step that isn't inside what the current step calls; from a context step, next. */
export function stepOver(session: SteppingSession): SteppingSession {
  const step = executedStep(session)
  if (step === undefined) {
    return stepNext(session)
  }

  const { enteredBy, runningAt } = session.functions
  const fn = enteredBy(step.id)
  const isInsideCalls = (later: TrekStep) =>
    runningAt(later.id).includes(fn) && enteredBy(later.id) !== fn

  return nextWhere(session, (later) => !isInsideCalls(later))
}

/** The next step outside the current step's function; from a context step, next. */
export function stepOut(session: SteppingSession): SteppingSession {
  const step = executedStep(session)
  if (step === undefined) {
    return stepNext(session)
  }

  const { enteredBy, runningAt } = session.functions
  const fn = enteredBy(step.id)

  return nextWhere(session, (later) => !runningAt(later.id).includes(fn))
}
