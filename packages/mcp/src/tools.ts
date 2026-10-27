import {
  SubmittedStepSchema,
  TOOL_DESCRIPTIONS,
  TourHeaderSchema,
  buildTourPrompt,
  changeFiles,
  changePatch,
  listFiles,
  readLines,
  search,
} from "@codetrail/core"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { formatChange, formatFileChanges, formatLines, formatMatches } from "./format"
import { type SessionCell, apply } from "./cell"
import { addStepsTo, draftStepIds, finish, open, repoIn, start } from "./session"
import { wordsOf } from "./words"

const repo = z.string().describe("a repo's name, as open_change lists it")
const folder = z.string().optional().describe("only files under this folder")

function text(answer: string) {
  return { content: [{ type: "text" as const, text: answer }] }
}

// An answer the agent should act on before going further.
function problem(answer: string) {
  return { ...text(answer), isError: true }
}

/** The tools an agent reads a change with. A thrown error reaches the agent as the answer. */
export function registerReadTools(server: McpServer, cell: SessionCell): void {
  server.registerTool(
    "open_change",
    {
      description: TOOL_DESCRIPTIONS.open_change,
      inputSchema: z.object({ args: z.array(z.string()).default([]) }),
    },
    async ({ args }) => {
      const change = await apply(cell, (session) => open(session, args))

      return text(formatChange(change))
    },
  )

  server.registerTool(
    "list_files",
    { description: TOOL_DESCRIPTIONS.list_files, inputSchema: z.object({ repo, folder }) },
    async (input) => {
      const files = await listFiles(repoIn(cell.session, input.repo), input.folder)

      return text(files.join("\n"))
    },
  )

  server.registerTool(
    "read_file",
    {
      description: TOOL_DESCRIPTIONS.read_file,
      inputSchema: z.object({
        repo,
        path: z.string(),
        from: z.number().int().min(1).optional(),
        to: z.number().int().min(1).optional(),
      }),
    },
    async (input) => {
      const lines = await readLines(
        repoIn(cell.session, input.repo),
        input.path,
        input.from,
        input.to,
      )

      return text(formatLines(lines))
    },
  )

  server.registerTool(
    "search",
    {
      description: TOOL_DESCRIPTIONS.search,
      inputSchema: z.object({ repo, pattern: z.string(), folder }),
    },
    async (input) => {
      const result = await search(repoIn(cell.session, input.repo), input.pattern, input.folder)

      return text(formatMatches(result))
    },
  )

  server.registerTool(
    "diff",
    {
      description: TOOL_DESCRIPTIONS.diff,
      inputSchema: z.object({ repo, path: z.string().optional() }),
    },
    async (input) => {
      const changed = repoIn(cell.session, input.repo)
      if (input.path === undefined) {
        return text(formatFileChanges(await changeFiles(changed)))
      }

      return text(await changePatch(changed, input.path))
    },
  )
}

/** The tools an agent builds a tour with: the guide, then start, add checked steps, finish. */
export function registerBuildTools(server: McpServer, cell: SessionCell): void {
  server.registerTool(
    "tour_guide",
    {
      description: TOOL_DESCRIPTIONS.tour_guide,
      inputSchema: z.object({ change: z.string().optional() }),
    },
    ({ change }) => text(buildTourPrompt(wordsOf(change))),
  )

  server.registerTool(
    "start_tour",
    { description: TOOL_DESCRIPTIONS.start_tour, inputSchema: TourHeaderSchema },
    (header) => {
      cell.session = start(cell.session, header)
      return text(`started "${header.title}": add steps with add_steps`)
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
        return problem(`nothing was added:\n${problems.join("\n")}`)
      }

      const added = steps.map((step) => step.id).join(", ")
      const all = draftStepIds(cell.session).join(", ")

      return text(`added ${added}; the tour has ${all}`)
    },
  )

  server.registerTool(
    "finish_tour",
    {
      description: TOOL_DESCRIPTIONS.finish_tour,
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }) => {
      const finished = await apply(cell, (session) => finish(session, name))
      if ("problems" in finished) {
        return problem(finished.problems.join("\n"))
      }

      return text(`saved ${finished.saved}`)
    },
  )
}
