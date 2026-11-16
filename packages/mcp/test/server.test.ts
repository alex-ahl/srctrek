import { afterEach, describe, expect, test } from "bun:test"
import { basename, join } from "node:path"
import {
  SERVER_INSTRUCTIONS,
  SET_AGENT_COMMAND,
  TOOL_DESCRIPTIONS,
  buildTrekPrompt,
} from "@srctrek/core"
import { z } from "zod"
import { McpTestClient } from "./support/mcp-client"
import { makeFeatureRepo } from "./support/repos"
import { repoAt, tempDir } from "@srctrek/testing"

const PromptListSchema = z.object({
  prompts: z.array(
    z.object({ name: z.string(), arguments: z.array(z.object({ name: z.string() })) }),
  ),
})

const PromptSchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.object({ text: z.string() }) })),
})

const ToolListSchema = z.object({
  tools: z.array(z.object({ name: z.string(), description: z.string() })),
})

let client: McpTestClient | undefined

afterEach(() => client?.close())

describe("trek mcp", () => {
  test("introduces itself and lists its tools with their descriptions", async () => {
    client = new McpTestClient(await makeFeatureRepo())

    const init = await client.initialize()
    expect(init.result).toMatchObject({
      serverInfo: { name: "srctrek" },
      instructions: SERVER_INSTRUCTIONS,
    })

    const { result } = await client.request("tools/list")
    const { tools } = ToolListSchema.parse(result)
    expect(Object.fromEntries(tools.map((tool) => [tool.name, tool.description]))).toEqual({
      ...TOOL_DESCRIPTIONS,
      set_agent_command: SET_AGENT_COMMAND,
    })
  })

  test("reads a change once it's open", async () => {
    const repo = await makeFeatureRepo()
    client = new McpTestClient(repo)
    await client.initialize()

    expect(await client.call("read_file", { repo: "x", path: "src/app.ts" })).toEqual({
      text: "no change is open: call open_change first",
      isError: true,
    })

    const opened = await client.call("open_change", { args: [] })
    const name = basename(repo)
    expect(opened.text).toMatch(new RegExp(`^${name}  [0-9a-f]{7}  [0-9a-f]{7}\\.\\.`))

    expect((await client.call("read_file", { repo: name, path: "src/app.ts" })).text).toBe(
      "src/app.ts\n1 | const total = 250\n2 | export { total }",
    )
    expect((await client.call("search", { repo: name, pattern: "total = " })).text).toBe(
      "src/app.ts:1: const total = 250",
    )
    expect((await client.call("diff", { repo: name })).text).toBe("modified src/app.ts")
    expect((await client.call("list_files", { repo: name, folder: "src" })).text).toBe("src/app.ts")
  })

  test("names the repos next to the current one that aren't opened", async () => {
    const parent = await tempDir("around-")
    for (const name of ["web", "api"]) {
      await repoAt(join(parent, name), `${name}\n`)
    }
    client = new McpTestClient(join(parent, "web"))
    await client.initialize()

    const opened = await client.call("open_change", { args: ["--code"] })

    expect(opened.text.split("\n").at(-1)).toBe("not opened, next to this repo: ../api")
  })

  test("offers the trek-building guide as a prompt, with the change filled in", async () => {
    client = new McpTestClient(await makeFeatureRepo())
    await client.initialize()

    const { prompts } = PromptListSchema.parse((await client.request("prompts/list")).result)
    expect(prompts.map((prompt) => [prompt.name, prompt.arguments.map((arg) => arg.name)])).toEqual(
      [["build_trek", ["change"]]],
    )

    const asked = await client.request("prompts/get", {
      name: "build_trek",
      arguments: { change: "../api  main...feature" },
    })
    const [message] = PromptSchema.parse(asked.result).messages
    expect(message?.role).toBe("user")
    expect(message?.content.text).toBe(buildTrekPrompt(["../api", "main...feature"]))
    expect(message?.content.text).toEndWith('these args: ["../api","main...feature"]')
  })

  test("gives the same guide as a tool, so asking in plain words works too", async () => {
    client = new McpTestClient(await makeFeatureRepo())
    await client.initialize()

    expect(await client.call("trek_guide", { change: "main...feature --uncommitted" })).toEqual({
      text: buildTrekPrompt(["main...feature", "--uncommitted"]),
      isError: false,
    })
  })
})
