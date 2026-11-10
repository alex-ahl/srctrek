import {
  SET_AGENT_COMMAND,
  agentSavedAnswer,
  agentSetting,
  agentUnsavedAnswer,
  checkAgent,
  loadSettings,
  saveSetting,
  settingsPath,
} from "@srctrek/core"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

const command = z
  .string()
  .min(1)
  .describe(
    "the shell command that runs you headless, ending with the option that takes the prompt",
  )

/**
 * The tool an agent sets srctrek up with: it saves the command that runs the agent headless, once
 * the command has started and answered, so a broken one is fixed in the chat that wrote it.
 */
export function registerSetupTools(server: McpServer): void {
  server.registerTool(
    "set_agent_command",
    { description: SET_AGENT_COMMAND, inputSchema: z.object({ command }) },
    async (input) => {
      const check = await checkAgent(input.command)
      if (!check.ok) {
        return {
          content: [{ type: "text" as const, text: agentUnsavedAnswer(check.problem) }],
          isError: true,
        }
      }

      await saveSetting("agent", input.command)
      const overridden = agentSetting(await loadSettings()).source === "environment"

      return {
        content: [{ type: "text" as const, text: agentSavedAnswer(settingsPath(), overridden) }],
      }
    },
  )
}
