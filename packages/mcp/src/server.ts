import { SERVER_INSTRUCTIONS, SRCTREK_VERSION } from "@srctrek/core"
import { McpServer } from "@modelcontextprotocol/server"
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"
import { registerPrompts } from "./prompts"
import { recordDraftFor, reportFor } from "./report"
import { newSession } from "./session"
import { registerSetupTools } from "./setup"
import { registerBuildTools } from "./build-tools"
import { registerReadTools } from "./read-tools"

/** `trek mcp`: an MCP server over stdin and stdout for the agent that builds a trek. */
export async function startMcpServer(cwd: string): Promise<void> {
  const server = new McpServer(
    { name: "srctrek", version: SRCTREK_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  )
  const cell = { session: newSession(cwd) }
  const report = reportFor()
  registerReadTools(server, cell, report)
  registerBuildTools(server, cell, report, recordDraftFor())
  registerSetupTools(server)
  registerPrompts(server)

  await server.connect(new StdioServerTransport())
}
