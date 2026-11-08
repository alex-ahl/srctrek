import { SERVER_INSTRUCTIONS, TRAIL_VERSION } from "@srctrek/core"
import { McpServer } from "@modelcontextprotocol/server"
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"
import { registerPrompts } from "./prompts"
import { reportFor } from "./report"
import { newSession } from "./session"
import { registerBuildTools, registerReadTools } from "./tools"

/** `trek mcp`: an MCP server over stdin and stdout for the agent that builds a trek. */
export async function startMcpServer(cwd: string): Promise<void> {
  const server = new McpServer(
    { name: "srctrek", version: TRAIL_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  )
  const cell = { session: newSession(cwd) }
  const report = reportFor()
  registerReadTools(server, cell, report)
  registerBuildTools(server, cell, report)
  registerPrompts(server)

  await server.connect(new StdioServerTransport())
}
