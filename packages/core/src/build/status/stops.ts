import type { Trek } from "../../schema/trek"

/**
 * The ids of a trek's stops, the steps a reader steps through: context steps are opened from the
 * step they explain, so editors don't number them, and counts of steps leave them out.
 */
export function stopIds(trek: Trek): Set<string> {
  return new Set(trek.steps.filter((step) => step.kind !== "context").map((step) => step.id))
}
