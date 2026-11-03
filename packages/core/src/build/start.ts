import type { ResolvedChange } from "../change/resolve"
import { startBuild } from "./background"
import { tourStatus } from "./status"

/** The agent's headless command line from `CODETRAIL_AGENT`; unset or blank means none. */
export function agentCommand(): string | undefined {
  const command = process.env["CODETRAIL_AGENT"]?.trim()

  return command === "" ? undefined : command
}

/**
 * Starts the agent on the change's tour, under the name a new tour of it gets: updating the
 * tour already there when it's out of date, else building one. `args` are trail's own, which the
 * agent opens the change with.
 */
export async function buildChangeTour(
  cwd: string,
  args: string[],
  change: ResolvedChange,
  agent: string,
): Promise<void> {
  const { kind, name } = await tourStatus(cwd, change)
  await startBuild(cwd, args, name, agent, kind === "stale" ? "update" : "build")
}
