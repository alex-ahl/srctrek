import type { ResolvedChange } from "../change/resolve"
import { startBuild } from "./background"
import { trekStatus } from "./status"

/** The agent's headless command line from `SRCTREK_AGENT`; unset or blank means none. */
export function agentCommand(): string | undefined {
  const command = process.env["SRCTREK_AGENT"]?.trim()

  return command === "" ? undefined : command
}

/**
 * Starts the agent on the change's trek, under the name its status gives: updating the trek
 * already there when it's out of date, else building one afresh, which replaces a trek built
 * with an older guide or one that isn't valid. `args` are trek's own, which the agent opens the
 * change with.
 */
export async function buildChangeTrek(
  cwd: string,
  args: string[],
  change: ResolvedChange,
  agent: string,
): Promise<void> {
  const { kind, name } = await trekStatus(cwd, change)
  await startBuild(cwd, args, name, agent, kind === "stale" ? "update" : "build")
}
