import agentCheck from "../../prompts/agent_check.md" with { type: "text" }

/** Whether the agent's command starts and answers; when it doesn't, the end of what it said. */
export type AgentCheck = Readonly<{ ok: true } | { ok: false; problem: string }>

// A real agent can take a while to start and answer even a one-word prompt.
const CHECK_TIMEOUT_MS = 120_000
const PROBLEM_LINES = 2

// The last few lines a failed run printed, which usually say why.
function lastLines(output: string): string {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-PROBLEM_LINES)
    .join(" · ")
}

/**
 * Runs the agent's command once, as a build would, with a tiny instruction as its last argument,
 * so a typo or a missing login shows before a real build fails on it.
 */
export async function checkAgent(
  command: string,
  timeoutMs = CHECK_TIMEOUT_MS,
): Promise<AgentCheck> {
  const run = Bun.spawn(["sh", "-c", `${command} "$SRCTREK_PROMPT"`], {
    env: { ...process.env, SRCTREK_PROMPT: agentCheck.trim() },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })
  // Read as it runs, so a talkative agent can't fill the pipe and stall.
  const output = Promise.all([new Response(run.stdout).text(), new Response(run.stderr).text()])
  const finished = await Promise.race([
    run.exited.then(() => true),
    Bun.sleep(timeoutMs).then(() => false),
  ])
  if (!finished) {
    run.kill()
    return { ok: false, problem: "it didn't answer in time" }
  }

  if (run.exitCode === 0) {
    return { ok: true }
  }

  const [stdout, stderr] = await output
  const said = lastLines(`${stdout}\n${stderr}`)
  return { ok: false, problem: said === "" ? `it exited with code ${run.exitCode}` : said }
}
