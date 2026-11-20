import type { SteppingSession, TrekStep } from "@srctrek/core"

/**
 * A stop as the route map lists it: its number, how deep in the calls running there it sits (an
 * async hop starts afresh), whether a hop reached it, its repo where that changes, its file, line,
 * summary and predicted values, whether the change touched it, its flag, and whether it's been
 * stepped to.
 */
export type RouteStop = Readonly<{
  id: string
  number: number
  depth: number
  // the step kind, and the stop execution came from
  kind: TrekStep["kind"]
  from: string | undefined
  hop: boolean
  repo: string
  // the repo, on the first stop in it after another repo's
  repoChange: string | undefined
  name: string
  // its file in its repo, and its first line
  file: string
  line: number
  summary: string
  values: NonNullable<TrekStep["predicted_values"]>
  changed: boolean
  flag: NonNullable<TrekStep["uncertain"]> | undefined
  visited: boolean
}>

const placeOf = (step: TrekStep) =>
  `${step.file.split("/").at(-1) ?? step.file}:${String(step.start_line)}`

/** The trek's stops in order, each with its depth among the calls running at it. */
export function routeOf(session: SteppingSession): RouteStop[] {
  const stops = session.trek.steps.filter((step) => session.executed.has(step.id))

  return stops.map((step, i) => {
    const before = stops[i - 1]
    return {
      id: step.id,
      number: i + 1,
      depth: Math.max(0, session.functions.runningAt(step.id).length - 1),
      kind: step.kind,
      from: step.from,
      hop: i > 0 && step.kind === "hop",
      repo: step.repo,
      repoChange: before?.repo === step.repo ? undefined : step.repo,
      name: step.name ?? placeOf(step),
      file: step.file,
      line: step.start_line,
      summary: step.summary,
      values: step.predicted_values ?? [],
      changed: step.changed,
      flag: step.uncertain,
      visited: session.visited.has(step.id),
    }
  })
}

/**
 * The stops whose functions are running at the stop at `at`, outermost first, ending with it: for
 * each depth above it, the nearest stop before it at that depth.
 */
export function runningAt(route: readonly RouteStop[], at: number): number[] {
  const stop = route[at]
  if (stop === undefined) {
    return []
  }

  const callers = Array.from({ length: stop.depth }, (_, depth) =>
    route.slice(0, at).findLastIndex((each) => each.depth === depth),
  )
  return [...callers.filter((index) => index >= 0), at]
}

/** How many stops a call at `at` leads to: those after it, deeper, until the trek comes back out. */
export function insideOf(route: readonly RouteStop[], at: number): number {
  const depth = route[at]?.depth ?? 0
  const out = route.slice(at + 1).findIndex((each) => each.depth <= depth)
  return out === -1 ? route.length - at - 1 : out
}

/** The stops folded calls hide: those under each folded stop. */
export function hiddenBy(route: readonly RouteStop[], folded: ReadonlySet<string>): Set<string> {
  const under = (at: number) => route.slice(at + 1, at + 1 + insideOf(route, at))
  return new Set(
    route.flatMap((stop, at) => (folded.has(stop.id) ? under(at).map((each) => each.id) : [])),
  )
}

/** The stop a step `by` from `at` lands on, past those `hidden`; none past either end. */
export function stepPast(
  route: readonly RouteStop[],
  at: number,
  hidden: ReadonlySet<string>,
  by: 1 | -1,
): number | undefined {
  const shown = (index: number) => !hidden.has(route[index]?.id ?? "")
  const indexes = Array.from({ length: route.length }, (_, index) => index)
  const ahead = by === 1 ? indexes.slice(at + 1) : indexes.slice(0, at).toReversed()
  return ahead.find(shown)
}
