import { createHash } from "node:crypto"
import buildHeadless from "../prompts/build_headless.md" with { type: "text" }
import buildStopped from "../prompts/build_stopped.md" with { type: "text" }
import saveAs from "../prompts/save_as.md" with { type: "text" }
import serverInstructions from "../prompts/server_instructions.md" with { type: "text" }
import addSteps from "../prompts/tools/add_steps.md" with { type: "text" }
import diff from "../prompts/tools/diff.md" with { type: "text" }
import finishTour from "../prompts/tools/finish_tour.md" with { type: "text" }
import listFiles from "../prompts/tools/list_files.md" with { type: "text" }
import openChange from "../prompts/tools/open_change.md" with { type: "text" }
import proposeRepo from "../prompts/tools/propose_repo.md" with { type: "text" }
import readFile from "../prompts/tools/read_file.md" with { type: "text" }
import search from "../prompts/tools/search.md" with { type: "text" }
import startTour from "../prompts/tools/start_tour.md" with { type: "text" }
import recordTriggers from "../prompts/tools/record_triggers.md" with { type: "text" }
import tourGuide from "../prompts/tools/tour_guide.md" with { type: "text" }
import { GUIDE_PARTS, buildTourPrompt, findsTriggers } from "./guide"

/** What each tool tells the agent building a tour, by tool name. */
export const TOOL_DESCRIPTIONS = {
  open_change: openChange.trim(),
  list_files: listFiles.trim(),
  read_file: readFile.trim(),
  search: search.trim(),
  diff: diff.trim(),
  start_tour: startTour.trim(),
  add_steps: addSteps.trim(),
  finish_tour: finishTour.trim(),
  tour_guide: tourGuide.trim(),
  record_triggers: recordTriggers.trim(),
  propose_repo: proposeRepo.trim(),
}

/** What an agent is told about the server when it connects. */
export const SERVER_INSTRUCTIONS = serverInstructions.trim()

/**
 * The instruction for an agent working with no one to ask: the guide for `args`, and, when it
 * builds a tour rather than finding triggers, the name to save it as.
 */
export function headlessBuildPrompt(args: string[], name: string): string {
  const saving = findsTriggers(args) ? "" : `\n\n${saveAs.trim().replace("{{name}}", name)}`

  return buildHeadless.trim().replace("{{guide}}", `${buildTourPrompt(args)}${saving}`)
}

/** What the agent is told when its third rejected round ends the build. */
export const BUILD_STOPPED = buildStopped.trim()

/** Which prompts built a tour: a short hash of them all, recorded on every tour. */
export const PROMPT_HASH = createHash("sha256")
  .update(
    JSON.stringify({
      buildHeadless,
      buildStopped,
      saveAs,
      GUIDE_PARTS,
      SERVER_INSTRUCTIONS,
      TOOL_DESCRIPTIONS,
    }),
  )
  .digest("hex")
  .slice(0, 12)
