import { type CallStacks, callStacks } from "../schema/stacks"
import type { Trek, TrekStep } from "../schema/trek"
import { type RunningFunctions, runningFunctions } from "./functions"

/** Where a session stands: before the first step, on a step by its index, or past the last. */
export type Position =
  | { readonly kind: "overview" }
  | { readonly kind: "step"; readonly index: number }
  | { readonly kind: "end" }

/** One reader stepping through one trek. Moves are functions from one session to the next. */
export type SteppingSession = {
  readonly trek: Trek
  readonly at: Position
  // ids of the steps shown so far, so step into can offer the next call not yet seen
  readonly visited: ReadonlySet<string>
  // ids of the executed steps; next and prev pass over context steps, which the step they explain
  // offers
  readonly executed: ReadonlySet<string>
  readonly stacks: CallStacks
  readonly functions: RunningFunctions
}

/** A session on `trek`, at its overview. */
export function openSession(trek: Trek): SteppingSession {
  const stacks = callStacks(trek.steps)

  return {
    trek,
    at: { kind: "overview" },
    visited: new Set(),
    executed: new Set(stacks.stacks.keys()),
    stacks,
    functions: runningFunctions(stacks),
  }
}

/** The step the session is on, if it's on one. */
export function currentStep(session: SteppingSession): TrekStep | undefined {
  return session.at.kind === "step" ? session.trek.steps[session.at.index] : undefined
}
