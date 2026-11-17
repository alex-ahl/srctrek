import {
  ProposedRepoSchema,
  SubmittedStepSchema,
  TOOL_DESCRIPTIONS,
  TrekHeaderSchema,
  TriggerSchema,
  buildTrekPrompt,
  proposalOpenedAnswer,
  proposalUnopenedAnswer,
  trekStartedAnswer,
  updateStartedAnswer,
} from "@srctrek/core"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { type SessionCell, apply } from "./cell"
import type { RecordDraft, Report } from "./report"
import {
  addStepsTo,
  draftStepIds,
  finish,
  proposeRepo,
  recordTriggers,
  start,
  update,
} from "./session"
import { wordsOf } from "./words"
import { answered, refuse, tell } from "./answers"

export function registerBuildTools(
  server: McpServer,
  cell: SessionCell,
  report: Report,
  recordDraft: RecordDraft,
): void {
  server.registerTool(
    "trek_guide",
    {
      description: TOOL_DESCRIPTIONS.trek_guide,
      inputSchema: z.object({ change: z.string().optional() }),
    },
    ({ change }) => answered(report, "trek_guide", buildTrekPrompt(wordsOf(change))),
  )

  server.registerTool(
    "start_trek",
    { description: TOOL_DESCRIPTIONS.start_trek, inputSchema: TrekHeaderSchema },
    async (header) => {
      await apply(cell, async (session) => start(session, header))
      await recordDraft(cell.session.draft)

      return tell(report, trekStartedAnswer(header.title))
    },
  )

  server.registerTool(
    "add_steps",
    {
      description: TOOL_DESCRIPTIONS.add_steps,
      inputSchema: z.object({ steps: z.array(SubmittedStepSchema).min(1) }),
    },
    async ({ steps }) => {
      const problems = await apply(cell, (session) => addStepsTo(session, steps))
      if (problems.length > 0) {
        return refuse(report, `nothing was added:\n${problems.join("\n")}`)
      }

      await recordDraft(cell.session.draft)
      const added = steps.map((step) => step.id).join(", ")
      const all = draftStepIds(cell.session).join(", ")

      return tell(report, `added ${added}; the trek has ${all}`)
    },
  )

  server.registerTool(
    "finish_trek",
    {
      description: TOOL_DESCRIPTIONS.finish_trek,
      inputSchema: z.object({
        name: z.string(),
        title: z.string().min(1).optional(),
        overview: z.string().min(1).optional(),
        outcome: z.string().min(1).optional(),
      }),
    },
    async ({ name, ...revised }) => {
      const finished = await apply(cell, (session) => finish(session, name, revised))
      if ("problems" in finished) {
        return refuse(report, finished.problems.join("\n"))
      }

      return tell(report, `saved ${finished.saved}`)
    },
  )

  server.registerTool(
    "update_trek",
    { description: TOOL_DESCRIPTIONS.update_trek, inputSchema: z.object({ name: z.string() }) },
    async ({ name }) => {
      const updating = await apply(cell, (session) => update(session, name))
      await recordDraft(cell.session.draft)
      return tell(report, updateStartedAnswer(name, updating))
    },
  )

  server.registerTool(
    "record_triggers",
    {
      description: TOOL_DESCRIPTIONS.record_triggers,
      inputSchema: z.object({ triggers: z.array(TriggerSchema).min(1) }),
    },
    async ({ triggers }) => {
      const recorded = await recordTriggers(cell.session, triggers)
      if ("problems" in recorded) {
        return refuse(report, `nothing was recorded:\n${recorded.problems.join("\n")}`)
      }

      return tell(report, `saved ${triggers.length} triggers to ${recorded.saved}`)
    },
  )

  server.registerTool(
    "propose_repo",
    { description: TOOL_DESCRIPTIONS.propose_repo, inputSchema: ProposedRepoSchema },
    async (proposal) => {
      const proposed = await apply(cell, (session) => proposeRepo(session, proposal))
      if ("problems" in proposed) {
        return refuse(report, `nothing was proposed:\n${proposed.problems.join("\n")}`)
      }

      if ("opened" in proposed) {
        const revision = proposed.opened.revision.slice(0, 7)
        return tell(report, proposalOpenedAnswer(proposal.name, revision, proposed.readAt))
      }

      return tell(report, proposalUnopenedAnswer(proposal.name, proposed.notOpened))
    },
  )
}
