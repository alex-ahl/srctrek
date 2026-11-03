import {
  type ResolvedChange,
  type TourStatus,
  directoryIn,
  readChangeArguments,
  resolveChange,
  startBuild,
  tourStatus,
} from "@codetrail/core"
import { startMcpServer } from "@codetrail/mcp"
import { startServe } from "@codetrail/serve"
import { startHome } from "@codetrail/tui"

// The agent's headless command line; unset or blank means trail can't build tours.
function agentCommand(): string | undefined {
  const command = process.env["CODETRAIL_AGENT"]?.trim()

  return command === "" ? undefined : command
}

// Starts the agent on the change's tour, under the name a new tour of it gets: updating the
// tour already there when it's out of date, else building one.
async function buildTour(
  cwd: string,
  args: string[],
  agent: string,
  status: () => Promise<TourStatus>,
) {
  const { kind, name } = await status()
  await startBuild(cwd, args, name, agent, kind === "stale" ? "update" : "build")
}

// The same repos as trail's args, toured from one trigger: --code="<trigger>" for --code.
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

async function trail(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const change = await resolveChange(cwd, readChangeArguments(args, directoryIn(cwd)))
  const agent = agentCommand()

  const status = () => tourStatus(cwd, change)
  const build = agent === undefined ? undefined : () => buildTour(cwd, args, agent, status)
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
      console.error("trail serve: waiting for an editor on stdin; your editor's plugin starts it")
    }

    return startServe(process.cwd())
  }

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
