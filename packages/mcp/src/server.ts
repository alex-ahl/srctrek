import { McpServer } from "@modelcontextprotocol/server"
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"
import { TrailSession } from "./session"
import { registerReadTools } from "./tools"

/** `trail mcp`: an MCP server over stdin and stdout for the agent that builds a tour. */
export async function startMcpServer(cwd: string): Promise<void> {
  // Pre-release: there are no version numbers yet.
  const server = new McpServer({ name: "codetrail", version: "0.0.0" })
  registerReadTools(server, new TrailSession(cwd))

  await server.connect(new StdioServerTransport())
}
