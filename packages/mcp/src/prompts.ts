import { buildTourPrompt } from "@codetrail/core"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { wordsOf } from "./words"

/** The prompts a user picks in their agent, such as a slash command for building a tour. */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "build_tour",
    {
      title: "Build a codetrail tour",
      description: "Build a tour of a change: the current branch, or the words you'd give trail",
      argsSchema: z.object({
        change: z
          .string()
          .optional()
          .describe("as for trail: main...feature, ../api main...feature, a pull request URL"),
      }),
    },
    ({ change }) => {
      const text = buildTourPrompt(wordsOf(change))

      return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] }
    },
  )
}
