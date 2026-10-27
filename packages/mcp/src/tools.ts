import {
  SubmittedStepSchema,
  TOOL_DESCRIPTIONS,
  TourHeaderSchema,
  changeFiles,
  changePatch,
  listFiles,
  readLines,
  search,
} from "@codetrail/core"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { formatChange, formatFileChanges, formatLines, formatMatches } from "./format"
import type { TrailSession } from "./session"

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
export function registerReadTools(server: McpServer, session: TrailSession): void {
  server.registerTool(
    "open_change",
    {
      description: TOOL_DESCRIPTIONS.open_change,
      inputSchema: z.object({ args: z.array(z.string()).default([]) }),
    },
    async ({ args }) => text(formatChange(await session.open(args))),
  )

  server.registerTool(
    "list_files",
    { description: TOOL_DESCRIPTIONS.list_files, inputSchema: z.object({ repo, folder }) },
    async (input) => text((await listFiles(session.repo(input.repo), input.folder)).join("\n")),
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
      const lines = await readLines(session.repo(input.repo), input.path, input.from, input.to)

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
      const result = await search(session.repo(input.repo), input.pattern, input.folder)

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
      const changed = session.repo(input.repo)
      if (input.path === undefined) {
        return text(formatFileChanges(await changeFiles(changed)))
      }

      return text(await changePatch(changed, input.path))
    },
  )
}

/** The tools an agent builds a tour with: start it, add checked steps, finish and save it. */
export function registerBuildTools(server: McpServer, session: TrailSession): void {
  server.registerTool(
    "start_tour",
    { description: TOOL_DESCRIPTIONS.start_tour, inputSchema: TourHeaderSchema },
    (header) => {
      session.start(header)
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
      const problems = await session.addSteps(steps)
      if (problems.length > 0) {
        return problem(`nothing was added:\n${problems.join("\n")}`)
      }

      return text(
        `added ${steps.map((step) => step.id).join(", ")}; the tour has ${session.stepIds().join(", ")}`,
      )
    },
  )

  server.registerTool(
    "finish_tour",
    {
      description: TOOL_DESCRIPTIONS.finish_tour,
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }) => text(`saved ${await session.finish(name)}`),
  )
}
