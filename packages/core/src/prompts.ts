import { createHash } from "node:crypto"
import addSteps from "../prompts/tools/add_steps.md" with { type: "text" }
import diff from "../prompts/tools/diff.md" with { type: "text" }
import finishTour from "../prompts/tools/finish_tour.md" with { type: "text" }
import listFiles from "../prompts/tools/list_files.md" with { type: "text" }
import openChange from "../prompts/tools/open_change.md" with { type: "text" }
import readFile from "../prompts/tools/read_file.md" with { type: "text" }
import search from "../prompts/tools/search.md" with { type: "text" }
import startTour from "../prompts/tools/start_tour.md" with { type: "text" }

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
}

/** Which prompts built a tour: a short hash of them all, recorded on every tour. */
export const PROMPT_HASH = createHash("sha256")
  .update(JSON.stringify(TOOL_DESCRIPTIONS))
  .digest("hex")
  .slice(0, 12)
