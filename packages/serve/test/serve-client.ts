import { type ChildProcess, spawn } from "node:child_process"
import { join } from "node:path"
import { PROTOCOL_VERSION } from "@srctrek/core"
import {
  type MessageConnection,
  ResponseError,
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection,
} from "vscode-jsonrpc/node"

const TREK = join(import.meta.dir, "../../cli/src/main.ts")

/** An editor's side of the protocol, for tests: the real `trek serve` as a child process. */
export class ServeTestClient {
  private readonly proc: ChildProcess
  private readonly connection: MessageConnection
  readonly exited: Promise<number | null>

  constructor(cwd: string, env: Record<string, string> = {}) {
    this.proc = spawn("bun", [TREK, "serve"], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "inherit"],
    })
    this.exited = new Promise((resolve) => this.proc.on("exit", resolve))

    const { stdout, stdin } = this.proc
    if (stdout === null || stdin === null) {
      throw new Error("trek serve started without pipes")
    }
    this.connection = createMessageConnection(
      new StreamMessageReader(stdout),
      new StreamMessageWriter(stdin),
    )
    this.connection.listen()
  }

  request(method: string, params?: object): Promise<unknown> {
    return params === undefined
      ? this.connection.sendRequest(method)
      : this.connection.sendRequest(method, params)
  }

  initialize(protocolVersion = PROTOCOL_VERSION): Promise<unknown> {
    const client = { name: "contract-test", version: "0" }
    return this.request("initialize", { protocol_version: protocolVersion, client })
  }

  /** The code `trek serve` answers `method` with, when it refuses. */
  async errorCode(method: string, params?: object): Promise<number> {
    try {
      await this.request(method, params)
    } catch (error) {
      if (error instanceof ResponseError) {
        return error.code
      }

      throw error
    }

    throw new Error(`${method} was answered, not refused`)
  }

  /** Closes the editor's end of the pipes, as an editor quitting does. */
  close(): void {
    this.connection.dispose()
    this.proc.stdin?.end()
  }
}
