import {
  TOOL_DESCRIPTIONS,
  changeFiles,
  changePatch,
  listFiles,
  nearbyRepos,
  readLines,
  search,
} from "@srctrek/core"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import {
  formatChange,
  formatFileChanges,
  formatLines,
  formatListing,
  formatMatches,
  formatPatch,
} from "./format"
import { type SessionCell, apply } from "./cell"
import type { Report } from "./report"
import { open, repoIn } from "./session"
import { answered, text } from "./answers"

const repo = z.string().describe("a repo's name, as open_change lists it")
const folder = z.string().optional().describe("only files under this folder")

/** The tools an agent reads a change with. A thrown error reaches the agent as the answer. */
export function registerReadTools(server: McpServer, cell: SessionCell, report: Report): void {
  server.registerTool(
    "open_change",
    {
      description: TOOL_DESCRIPTIONS.open_change,
      inputSchema: z.object({ args: z.array(z.string()).default([]) }),
    },
    async ({ args }) => {
      const change = await apply(cell, (session) => open(session, args))
      await report(`opened ${change.repos.map(({ name }) => name).join(", ")}`)
      // Started outside a git repo, as for a pull request alone, there's no folder to look around.
      const nearby = await nearbyRepos(cell.session.cwd, change).catch(() => ({
        repos: [],
        leftOut: 0,
      }))

      return text(formatChange(change, nearby))
    },
  )

  server.registerTool(
    "list_files",
    {
      description: TOOL_DESCRIPTIONS.list_files,
      inputSchema: z.object({ repo, folder, recursive: z.boolean().optional() }),
    },
    async (input) => {
      const repoAt = repoIn(cell.session, input.repo)
      const listing = await listFiles(repoAt, input.folder, input.recursive ?? false)
      const recursive = input.recursive === true ? " (recursive)" : ""
      const asked = `list_files ${input.repo} ${input.folder ?? "."}${recursive}`

      return answered(report, asked)(formatListing(listing))
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
      const range = `${input.from ?? 1}–${input.to ?? "end"}`

      return answered(report, `read_file ${input.repo} ${input.path} ${range}`)(formatLines(lines))
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
      const within = input.folder === undefined ? "" : ` in ${input.folder}`
      const asked = `search ${input.repo} ${JSON.stringify(input.pattern)}${within}`

      return answered(report, asked)(formatMatches(result))
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
      const answer = answered(report, `diff ${input.repo} ${input.path ?? "(files)"}`)
      if (input.path === undefined) {
        return answer(formatFileChanges(await changeFiles(changed)))
      }

      return answer(formatPatch(await changePatch(changed, input.path)))
    },
  )
}

/** The tools an agent builds a trek with: the guide, then start, add checked steps, finish. */
