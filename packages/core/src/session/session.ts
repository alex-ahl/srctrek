import { type CallStacks, callStacks } from "../schema/stacks"
import type { Tour, TourStep } from "../schema/tour"
import { type RunningFunctions, runningFunctions } from "./functions"

/** Where a session stands: before the first step, on a step by its index, or past the last. */
export type Position =
  | { readonly kind: "overview" }
  | { readonly kind: "step"; readonly index: number }
  | { readonly kind: "end" }

/** One reader stepping through one tour. Moves are functions from one session to the next. */
export type SteppingSession = {
  readonly tour: Tour
  readonly at: Position
  // ids of the steps shown so far, so step into can offer the next call not yet seen
  readonly visited: ReadonlySet<string>
  // ids of the executed steps; context steps are visited in tour order but never entered
  readonly executed: ReadonlySet<string>
  readonly stacks: CallStacks
  readonly functions: RunningFunctions
}

/** A session on `tour`, at its overview. */
export function openSession(tour: Tour): SteppingSession {
  const stacks = callStacks(tour.steps)

  return {
    tour,
    at: { kind: "overview" },
    visited: new Set(),
    executed: new Set(stacks.stacks.keys()),
    stacks,
    functions: runningFunctions(stacks),
  }
}

/** The step the session is on, if it's on one. */
export function currentStep(session: SteppingSession): TourStep | undefined {
  return session.at.kind === "step" ? session.tour.steps[session.at.index] : undefined
}
