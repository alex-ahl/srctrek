import type { SteppingSession, TrekStep } from "@srctrek/core"

/**
 * A stop as the route map lists it: its number, how deep in the calls running there it sits (an
 * async hop starts afresh), its repo where that changes, its file, line and summary, whether the change
 * touched it, and whether it's been stepped to.
 */
export type RouteStop = Readonly<{
  id: string
  number: number
  depth: number
  repo: string
  // the repo, on the first stop in it after another repo's
  repoChange: string | undefined
  name: string
  // its file in its repo, and its first line
  file: string
  line: number
  summary: string
  changed: boolean
  flag: NonNullable<TrekStep["uncertain"]>["severity"] | undefined
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
      repo: step.repo,
      repoChange: before?.repo === step.repo ? undefined : step.repo,
      name: step.name ?? placeOf(step),
      file: step.file,
      line: step.start_line,
      summary: step.summary,
      changed: step.changed,
      flag: step.uncertain?.severity,
      visited: session.visited.has(step.id),
    }
  })
}
