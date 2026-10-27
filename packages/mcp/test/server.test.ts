import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { TOOL_DESCRIPTIONS, runGit } from "@codetrail/core"
import { commit, commitStaged, makeRepo } from "../../core/test/support/repo"
import { z } from "zod"
import { McpTestClient } from "./mcp-client"

const ToolListSchema = z.object({
  tools: z.array(z.object({ name: z.string(), description: z.string() })),
})

// A repo on a feature branch that changes src/app.ts.
async function makeFeatureRepo(): Promise<string> {
  const dir = await makeRepo()
  await mkdir(join(dir, "src"))
  await writeFile(join(dir, "src/app.ts"), "const total = 100\nexport { total }\n")
  await runGit(dir, ["add", "--all"])
  await commitStaged(dir, "base")
  await runGit(dir, ["switch", "--quiet", "-c", "feature"])
  await commit(dir, "src/app.ts", "const total = 250\nexport { total }\n")

  return dir
}

let client: McpTestClient | undefined

afterEach(() => client?.close())

describe("trail mcp", () => {
  test("introduces itself and lists its tools with their descriptions", async () => {
    client = new McpTestClient(await makeFeatureRepo())

    const init = await client.initialize()
    expect(init.result).toMatchObject({ serverInfo: { name: "codetrail" } })

    const { result } = await client.request("tools/list")
    const { tools } = ToolListSchema.parse(result)
    expect(Object.fromEntries(tools.map((tool) => [tool.name, tool.description]))).toEqual(
      TOOL_DESCRIPTIONS,
    )
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
})
