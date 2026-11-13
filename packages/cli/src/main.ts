import {
  type ResolvedChange,
  agentSetting,
  buildChangeTrek,
  changeFromArguments,
  choiceOfArguments,
  errorText,
  loadSettings,
  startBuild,
  summarizeChange,
  trekStatus,
  worktreeStamp,
} from "@srctrek/core"
import { startMcpServer } from "@srctrek/mcp"
import { startServe } from "@srctrek/serve"
import { type HomeChange, startHome } from "@srctrek/tui"

// The same repos as trek's args, followed from one trigger: --code="<trigger>" for --code.
function argsForTrigger(args: string[], trigger: string): string[] {
  return [...args.filter((arg) => !arg.startsWith("--code")), `--code=${trigger}`]
}

// Starts the agent on the trek of one trigger found in the code.
async function buildTriggerTrek(
  cwd: string,
  args: string[],
  agent: string,
  change: ResolvedChange,
  trigger: string,
) {
  const { name } = await trekStatus(cwd, { ...change, code: { trigger } })
  await startBuild(cwd, argsForTrigger(args, trigger), name, agent)
}

// The change trek's args name, as it stands now, with the agent as the settings name it now. A
// change with no trek gets one started right away, when the user asked for that and there's an
// agent to build it.
async function openChange(cwd: string, args: string[]): Promise<HomeChange> {
  const change = await changeFromArguments(cwd, args)
  const settings = await loadSettings()
  const agent = agentSetting(settings).command

  const status = () => trekStatus(cwd, change)
  const build = agent === undefined ? undefined : () => buildChangeTrek(cwd, args, change, agent)
  const buildTrigger =
    agent === undefined
      ? undefined
      : (trigger: string) => buildTriggerTrek(cwd, args, agent, change, trigger)

  const startsBuild = settings.build_automatically === true && build !== undefined
  if (startsBuild && (await status()).kind === "missing") {
    await build()
  }

  return { summary: await summarizeChange(change), status, build, buildTrigger }
}

// What moves the change on while trek is open: the worktree, and the agent the settings name.
async function changeStamp(cwd: string): Promise<string> {
  const agent = agentSetting(await loadSettings().catch(() => ({}))).command
  return `${await worktreeStamp(cwd)}\n${agent ?? ""}`
}

async function trek(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const change = await openChange(cwd, args)
  const follow = {
    choice: choiceOfArguments(args),
    stamp: () => changeStamp(cwd),
    open: (chosen: string[]) => openChange(cwd, chosen),
  }

  await startHome(cwd, change, await loadSettings(), follow)
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
  console.error(`trek: ${errorText(error)}`)
  process.exit(1)
}
