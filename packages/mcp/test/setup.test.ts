import { afterEach, describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { McpTestClient } from "./mcp-client"
import { tempDir } from "@srctrek/testing"

let client: McpTestClient | undefined

afterEach(() => client?.close())

// trek mcp with its settings in a folder of their own, and no SRCTREK_AGENT to override them.
async function serverWithSettings() {
  const config = await tempDir("config-")
  client = new McpTestClient(await tempDir("cwd-"), { XDG_CONFIG_HOME: config, SRCTREK_AGENT: "" })
  await client.initialize()

  return { server: client, settings: join(config, "srctrek", "settings.json") }
}

describe("set_agent_command", () => {
  test("saves a command that starts and answers", async () => {
    const { server, settings } = await serverWithSettings()
    const answer = await server.call("set_agent_command", { command: "test -n" })

    expect(answer.isError).toBe(false)
    expect(answer.text).toContain("it started and answered")
    expect(JSON.parse(await readFile(settings, "utf8"))).toEqual({ agent: "test -n" })
  })

  test("saves nothing when the command fails, and says what it printed", async () => {
    const { server, settings } = await serverWithSettings()
    const answer = await server.call("set_agent_command", {
      command: "echo 'unknown option' >&2; false",
    })

    expect(answer.isError).toBe(true)
    expect(answer.text).toContain("Not saved: running the command failed (unknown option)")
    expect(await readFile(settings, "utf8").catch(() => "missing")).toBe("missing")
  })
})
