import changeOpening from "../prompts/build_trek/change.md" with { type: "text" }
import codeOpening from "../prompts/build_trek/code.md" with { type: "text" }
import method from "../prompts/build_trek/method.md" with { type: "text" }
import findTriggers from "../prompts/find_triggers.md" with { type: "text" }
import { readOptions } from "./change/options"

/** Every part the guide is made from, for the prompt hash. */
export const GUIDE_PARTS = { changeOpening, codeOpening, method, findTriggers }

/** Whether `trek`'s `args` ask for the code's triggers (plain --code) rather than a trek. */
export function findsTriggers(args: string[]): boolean {
  const { code } = readOptions(args)

  return code !== undefined && code.trigger === undefined
}

/**
 * The guide for what `trek`'s `args` ask for: a trek of a change (none means the branch), a
 * trek of code as it is from the user's trigger, or, with plain --code, finding the triggers
 * the user can choose from.
 */
export function buildTrekPrompt(args: string[]): string {
  const { code } = readOptions(args)
  const withArgs = (text: string) => text.replace("{{args}}", JSON.stringify(args))
  if (code === undefined) {
    return withArgs(`${changeOpening.trim()}\n\n${method.trim()}`)
  }

  if (code.trigger === undefined) {
    return withArgs(findTriggers.trim())
  }

  const opening = codeOpening.trim().replace("{{trigger}}", code.trigger)

  return withArgs(`${opening}\n\n${method.trim()}`)
}
