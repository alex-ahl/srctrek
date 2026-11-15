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
import type { Report } from "./report"
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
import { answered, problem, text } from "./answers"

export function registerBuildTools(server: McpServer, cell: SessionCell, report: Report): void {
  // The agent's answer, also written to the build's log, so the log shows what it was told.
  const tell = async (answer: string) => {
    await report(answer)
    return text(answer)
  }
  const refuse = async (answer: string) => {
    await report(answer)
    return problem(answer)
  }

  server.registerTool(
    "trek_guide",
    {
      description: TOOL_DESCRIPTIONS.trek_guide,
      inputSchema: z.object({ change: z.string().optional() }),
    },
    ({ change }) => answered(report, "trek_guide")(buildTrekPrompt(wordsOf(change))),
  )

  server.registerTool(
    "start_trek",
    { description: TOOL_DESCRIPTIONS.start_trek, inputSchema: TrekHeaderSchema },
    async (header) => {
      cell.session = start(cell.session, header)

      return tell(trekStartedAnswer(header.title))
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
        return refuse(`nothing was added:\n${problems.join("\n")}`)
      }

      const added = steps.map((step) => step.id).join(", ")
      const all = draftStepIds(cell.session).join(", ")

      return tell(`added ${added}; the trek has ${all}`)
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
        return refuse(finished.problems.join("\n"))
      }

      return tell(`saved ${finished.saved}`)
    },
  )

  server.registerTool(
    "update_trek",
    { description: TOOL_DESCRIPTIONS.update_trek, inputSchema: z.object({ name: z.string() }) },
    async ({ name }) => {
      const updating = await apply(cell, (session) => update(session, name))
      return tell(updateStartedAnswer(name, updating))
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
        return refuse(`nothing was recorded:\n${recorded.problems.join("\n")}`)
      }

      return tell(`saved ${triggers.length} triggers to ${recorded.saved}`)
    },
  )

  server.registerTool(
    "propose_repo",
    { description: TOOL_DESCRIPTIONS.propose_repo, inputSchema: ProposedRepoSchema },
    async (proposal) => {
      const proposed = await apply(cell, (session) => proposeRepo(session, proposal))
      if ("problems" in proposed) {
        return refuse(`nothing was proposed:\n${proposed.problems.join("\n")}`)
      }

      if ("opened" in proposed) {
        const revision = proposed.opened.revision.slice(0, 7)
        return tell(proposalOpenedAnswer(proposal.name, revision, proposed.readAt))
      }

      return tell(proposalUnopenedAnswer(proposal.name, proposed.notOpened))
    },
  )
}
