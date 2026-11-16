import type { Severity, TrekStep } from "./trek"

/** How many of `steps` carry a flag of each severity. */
export function flagCounts(steps: readonly TrekStep[]): Record<Severity, number> {
  const flagged = (severity: Severity) =>
    steps.filter((step) => step.uncertain?.severity === severity).length

  return { high: flagged("high"), medium: flagged("medium"), low: flagged("low") }
}
