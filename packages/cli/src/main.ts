import { directoryIn, readChangeArguments, resolveChange } from "@codetrail/core"
import { startMcpServer } from "@codetrail/mcp"
import { startHome } from "@codetrail/tui"

async function trail(args: string[]): Promise<void> {
  const cwd = process.cwd()

  // Nothing builds a tour from the change before Milestone 3; resolving it now still fails
  // early, with a message, on arguments that can't be used.
  await resolveChange(cwd, readChangeArguments(args, directoryIn(cwd)))

  await startHome(cwd)
}

// "mcp" as the first word is the command: a folder by that name is given as ./mcp, a branch
// as part of a range (main...mcp).
async function run(args: string[]): Promise<void> {
  if (args[0] === "mcp") {
    // Started by hand, the server would sit silent waiting for a client; stderr leaves the
    // protocol on stdout alone.
    if (process.stdin.isTTY) {
      console.error("trail mcp: waiting for an MCP client on stdin; register it with your agent")
    }

    return startMcpServer(process.cwd())
  }

  return trail(args)
}

try {
  await run(process.argv.slice(2))
} catch (error) {
  console.error(`trail: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
