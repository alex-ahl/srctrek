import { createHash } from "node:crypto"
import proposalOpened from "../prompts/answers/proposal_opened.md" with { type: "text" }
import proposalUnopened from "../prompts/answers/proposal_unopened.md" with { type: "text" }
import flagBehind from "../prompts/answers/flag_behind.md" with { type: "text" }
import flagDefault from "../prompts/answers/flag_default.md" with { type: "text" }
import readAtDefault from "../prompts/answers/read_at_default.md" with { type: "text" }
import readAtPinned from "../prompts/answers/read_at_pinned.md" with { type: "text" }
import readAtTracking from "../prompts/answers/read_at_tracking.md" with { type: "text" }
import readAtWorkBranch from "../prompts/answers/read_at_work_branch.md" with { type: "text" }
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
import type { ReadAt } from "./change/resolve"
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

// A template with each {{key}} replaced by its value.
function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template.trim(),
  )
}

function readAtText(revision: string, readAt: ReadAt): string {
  if (readAt.kind === "work-branch") {
    const { branch, shown } = readAt
    return fill(shown === branch ? readAtWorkBranch : readAtTracking, { branch, shown })
  }

  if (readAt.kind === "pinned") {
    return fill(readAtPinned, { revision: readAt.revision })
  }

  return fill(readAtDefault, { revision, why: readAt.why })
}

// What the agent must flag on the hop into the repo when how it was read is in doubt.
function flagText(name: string, readAt: ReadAt): string[] {
  if (readAt.kind === "default") {
    return [fill(flagDefault, { name, why: readAt.why })]
  }

  if (readAt.kind === "work-branch" && readAt.behind !== undefined) {
    const { commits, upstream } = readAt.behind
    return [fill(flagBehind, { name, branch: readAt.branch, commits: String(commits), upstream })]
  }

  return []
}

/**
 * What the agent is told when the repo it proposed is opened, so the tour can go on into it:
 * what it was read at, and what to flag when that's in doubt.
 */
export function proposalOpenedAnswer(name: string, revision: string, readAt: ReadAt): string {
  const opened = fill(proposalOpened, { name, read_at: readAtText(revision, readAt) })

  return [opened, ...flagText(name, readAt)].join("\n\n")
}

/** What the agent is told when the repo it proposed can't be opened: no source, or a failure. */
export function proposalUnopenedAnswer(name: string, reason: string): string {
  return proposalUnopened.trim().replace("{{name}}", name).replace("{{reason}}", reason)
}

/** Which prompts built a tour: a short hash of them all, recorded on every tour. */
export const PROMPT_HASH = createHash("sha256")
  .update(
    JSON.stringify({
      buildHeadless,
      buildStopped,
      proposalOpened,
      proposalUnopened,
      readAtWorkBranch,
      readAtTracking,
      readAtPinned,
      readAtDefault,
      flagDefault,
      flagBehind,
      saveAs,
      GUIDE_PARTS,
      SERVER_INSTRUCTIONS,
      TOOL_DESCRIPTIONS,
    }),
  )
  .digest("hex")
  .slice(0, 12)
