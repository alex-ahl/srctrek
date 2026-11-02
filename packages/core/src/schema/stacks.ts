import type { TourStep } from "./tour"

type Link = Pick<TourStep, "id" | "repo" | "file" | "kind" | "from">

/**
 * Each executed step's call stack as step ids, outermost first; the step a stack's hop came
 * from, for the stacks under it; the step each return carries on from; the hops a return
 * comes back across, as a response does to its request; and the returns that fit no frame.
 */
export type CallStacks = {
  stacks: ReadonlyMap<string, readonly string[]>
  beneath: ReadonlyMap<string, string | undefined>
  continues: ReadonlyMap<string, string>
  answeredHops: ReadonlySet<string>
  misplacedReturns: readonly string[]
}

const sameFile = (a: Link, b: Link) => a.repo === b.repo && a.file === b.file

/**
 * Works out the call stacks from the tour's links, in tour order: a call goes on top of the
 * step it came from, a hop starts a stack of its own, and a return takes the place of the
 * nearest frame below it in its own file, found back across hops to their cause. A step
 * whose `from` names no earlier executed step starts a stack; other rules report it.
 */
export function callStacks(steps: readonly Link[]): CallStacks {
  const byId = new Map(steps.map((step) => [step.id, step]))
  const stacks = new Map<string, readonly string[]>()
  // The step a stack's hop came from: what execution can return into past the stack's bottom.
  // A return that takes the place of a hop keeps it, as an HTTP response goes back to its caller.
  const beneath = new Map<string, string | undefined>()
  const continues = new Map<string, string>()
  const answeredHops = new Set<string>()
  const misplacedReturns: string[] = []

  const reachable = (id: string): readonly string[] => {
    const below = beneath.get(id)
    return [...(below === undefined ? [] : reachable(below)), ...(stacks.get(id) ?? [])]
  }

  const inFileOf = (step: Link) => (id: string) => {
    const frame = byId.get(id)
    return frame !== undefined && sameFile(frame, step)
  }

  const place = (id: string, stack: readonly string[], below: string | undefined) => {
    stacks.set(id, stack)
    beneath.set(id, below)
  }

  // Each hop a return from `from` comes back across to reach `landsIn`, a frame beneath it.
  const markAnswered = (from: string, landsIn: string) => {
    let at: string | undefined = from
    while (at !== undefined && !(stacks.get(at) ?? []).includes(landsIn)) {
      const hop = stacks.get(at)?.[0]
      if (hop !== undefined) {
        answeredHops.add(hop)
      }
      at = beneath.get(at)
    }
  }

  // The return takes the place of the frame it lands in, under that frame's own stack. One
  // that lands nowhere is stacked as the call it likely is, so the steps after it aren't
  // reported for its mistake.
  const placeReturn = (step: Link, from: string) => {
    const landsIn = reachable(from).slice(0, -1).findLast(inFileOf(step))
    if (landsIn === undefined) {
      misplacedReturns.push(step.id)
      place(step.id, [...(stacks.get(from) ?? []), step.id], beneath.get(from))
      return
    }

    place(step.id, [...(stacks.get(landsIn) ?? []).slice(0, -1), step.id], beneath.get(landsIn))
    continues.set(step.id, landsIn)
    markAnswered(from, landsIn)
  }

  for (const step of steps) {
    if (step.kind === "context") {
      continue
    }

    const from = step.from !== undefined && stacks.has(step.from) ? step.from : undefined
    if (from === undefined) {
      place(step.id, [step.id], undefined)
    } else if (step.kind === "hop") {
      place(step.id, [step.id], from)
    } else if (step.kind === "call") {
      place(step.id, [...(stacks.get(from) ?? []), step.id], beneath.get(from))
    } else {
      placeReturn(step, from)
    }
  }

  return { stacks, beneath, continues, answeredHops, misplacedReturns }
}
