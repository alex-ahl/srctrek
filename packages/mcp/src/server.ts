import { SERVER_INSTRUCTIONS } from "@codetrail/core"
import { McpServer } from "@modelcontextprotocol/server"
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"
import { registerPrompts } from "./prompts"
import { TrailSession } from "./session"
import { registerBuildTools, registerReadTools } from "./tools"

/** `trail mcp`: an MCP server over stdin and stdout for the agent that builds a tour. */
export async function startMcpServer(cwd: string): Promise<void> {
  // Pre-release: there are no version numbers yet.
  const server = new McpServer(
    { name: "codetrail", version: "0.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  )
  const session = new TrailSession(cwd)
  registerReadTools(server, session)
  registerBuildTools(server, session)
  registerPrompts(server)

  await server.connect(new StdioServerTransport())
}
