import changeOpening from "../prompts/build_tour/change.md" with { type: "text" }
import codeOpening from "../prompts/build_tour/code.md" with { type: "text" }
import method from "../prompts/build_tour/method.md" with { type: "text" }
import triggerNamed from "../prompts/build_tour/trigger_named.md" with { type: "text" }
import triggerOpen from "../prompts/build_tour/trigger_open.md" with { type: "text" }
import { type CodeTour, readOptions } from "./change/options"

/** Every part the guide is made from, for the prompt hash. */
export const GUIDE_PARTS = { changeOpening, codeOpening, method, triggerNamed, triggerOpen }

// How a tour of code as it is starts: from the trigger the user named, or one the agent picks.
function codeOpeningFor({ trigger }: CodeTour): string {
  const choice =
    trigger === undefined ? triggerOpen.trim() : triggerNamed.trim().replace("{{trigger}}", trigger)

  return codeOpening.trim().replace("{{trigger}}", choice)
}

/**
 * The guide for building a tour of what `trail`'s `args` name: a change (none means the
 * branch), or code as it is with --code.
 */
export function buildTourPrompt(args: string[]): string {
  const { code } = readOptions(args)
  const opening = code === undefined ? changeOpening.trim() : codeOpeningFor(code)

  return `${opening}\n\n${method.trim()}`.replace("{{args}}", JSON.stringify(args))
}
