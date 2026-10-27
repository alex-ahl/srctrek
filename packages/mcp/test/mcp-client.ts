import { join } from "node:path"
import { z } from "zod"

const TRAIL = join(import.meta.dir, "../../cli/src/main.ts")

const ResponseSchema = z.object({
  id: z.number(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
})
type Response = z.infer<typeof ResponseSchema>

const ToolResultSchema = z.object({
  content: z.array(z.object({ text: z.string() })),
  isError: z.boolean().optional(),
})

/** A minimal MCP client for tests: `trail mcp` as a child, JSON-RPC one line at a time. */
export class McpTestClient {
  #nextId = 1
  #pending = new Map<number, (response: Response) => void>()
  readonly #proc

  constructor(cwd: string) {
    this.#proc = Bun.spawn(["bun", TRAIL, "mcp"], {
      cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    })
    void this.#readResponses()
  }

  async #readResponses(): Promise<void> {
    let buffered = ""
    for await (const chunk of this.#proc.stdout.pipeThrough(new TextDecoderStream())) {
      buffered += chunk
      const lines = buffered.split("\n")
      buffered = lines.pop() ?? ""
      for (const line of lines.filter(Boolean)) {
        const response = ResponseSchema.parse(JSON.parse(line))
        this.#pending.get(response.id)?.(response)
      }
    }
  }

  #send(message: object): void {
    void this.#proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n")
  }

  request(method: string, params: object = {}): Promise<Response> {
    const id = this.#nextId++
    const response = new Promise<Response>((resolve) => this.#pending.set(id, resolve))
    this.#send({ id, method, params })

    return response
  }

  async initialize(): Promise<Response> {
    const response = await this.request("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    })
    this.#send({ method: "notifications/initialized" })

    return response
  }

  /** A tool's text answer, and whether the server flagged it as an error. */
  async call(name: string, args: object): Promise<{ text: string; isError: boolean }> {
    const { result } = await this.request("tools/call", { name, arguments: args })
    const { content, isError } = ToolResultSchema.parse(result)

    return { text: content.map((part) => part.text).join(""), isError: isError === true }
  }

  close(): void {
    this.#proc.kill()
  }
}
