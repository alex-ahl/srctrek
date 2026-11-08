import { buildTrekPrompt } from "@srctrek/core"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { wordsOf } from "./words"

/** The prompts a user picks in their agent, such as a slash command for building a trek. */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "build_trek",
    {
      title: "Build a trek",
      description: "Build a trek of a change: the current branch, or the words you'd give trek",
      argsSchema: z.object({
        change: z
          .string()
          .optional()
          .describe("as for trek: main...feature, ../api main...feature, a pull request URL"),
      }),
    },
    ({ change }) => {
      const text = buildTrekPrompt(wordsOf(change))

      return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] }
    },
  )
}
