import type { CallStacks } from "../schema/stacks"

/**
 * The functions running at each executed step, each named by the step that entered it: a
 * return carries on the function it comes back to, so it's named by that function's step.
 */
export type RunningFunctions = {
  // the step that entered the function `id` runs in
  enteredBy: (id: string) => string
  // the functions running at `id`, outermost first, back across the hops answered to their
  // caller; work a hop starts and nobody waits for (an event, a message) runs on its own
  runningAt: (id: string) => readonly string[]
}

export function runningFunctions(stacks: CallStacks): RunningFunctions {
  const { beneath, continues, answeredHops } = stacks

  const enteredBy = (id: string): string => {
    const earlier = continues.get(id)
    return earlier === undefined ? id : enteredBy(earlier)
  }

  const runningAt = (id: string): readonly string[] => {
    const stack = stacks.stacks.get(id) ?? []
    const below = answeredHops.has(stack[0] ?? "") ? beneath.get(id) : undefined
    const under = below === undefined ? [] : runningAt(below)

    return [...under, ...stack.map(enteredBy)]
  }

  return { enteredBy, runningAt }
}
