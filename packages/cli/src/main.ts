import {
  type ResolvedChange,
  agentCommand,
  buildChangeTour,
  directoryIn,
  readChangeArguments,
  resolveChange,
  startBuild,
  tourStatus,
} from "@srctrek/core"
import { startMcpServer } from "@srctrek/mcp"
import { startServe } from "@srctrek/serve"
import { startHome } from "@srctrek/tui"

// The same repos as trek's args, toured from one trigger: --code="<trigger>" for --code.
function argsForTrigger(args: string[], trigger: string): string[] {
  return [...args.filter((arg) => !arg.startsWith("--code")), `--code=${trigger}`]
}

// Starts the agent on the tour of one trigger found in the code.
async function buildTriggerTour(
  cwd: string,
  args: string[],
  agent: string,
  change: ResolvedChange,
  trigger: string,
) {
  const { name } = await tourStatus(cwd, { ...change, code: { trigger } })
  await startBuild(cwd, argsForTrigger(args, trigger), name, agent)
}

async function trek(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const change = await resolveChange(cwd, readChangeArguments(args, directoryIn(cwd)))
  const agent = agentCommand()

  const status = () => tourStatus(cwd, change)
  const build = agent === undefined ? undefined : () => buildChangeTour(cwd, args, change, agent)
  const buildTrigger =
    agent === undefined
      ? undefined
      : (trigger: string) => buildTriggerTour(cwd, args, agent, change, trigger)

  // A change with no tour gets one started right away, when there's an agent to build it.
  if (build !== undefined && (await status()).kind === "missing") {
    await build()
  }

  await startHome(cwd, { status, build, buildTrigger })
}

// "mcp" or "serve" as the first word is the command: a folder by that name is given as ./mcp,
// a branch as part of a range (main...mcp).
async function run(args: string[]): Promise<void> {
  if (args[0] === "serve") {
    if (process.stdin.isTTY) {
      console.error("trek serve: waiting for an editor on stdin; your editor's plugin starts it")
    }

    return startServe(process.cwd())
  }

  if (args[0] === "mcp") {
    // Started by hand, the server would sit silent waiting for a client; stderr leaves the
    // protocol on stdout alone.
    if (process.stdin.isTTY) {
      console.error("trek mcp: waiting for an MCP client on stdin; register it with your agent")
    }

    return startMcpServer(process.cwd())
  }

  return trek(args)
}

try {
  await run(process.argv.slice(2))
} catch (error) {
  console.error(`trek: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
