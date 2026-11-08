import { type ChildProcess, spawn } from "node:child_process"
import type { SessionView, ToursResult } from "@srctrek/core"
import {
  type MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection,
} from "vscode-jsonrpc/node"

// The protocol version this extension speaks; trek serve refuses another. The extension bundles
// none of core's code, so it keeps its own copy, which the contract tests check.
export const PROTOCOL_VERSION = 1
const CLIENT = { name: "srctrek-vscode", version: "0.0.0" }

/** The moves that answer with the session's view. */
export type Move = "next" | "prev" | "over" | "out" | "into" | "goto"

/** The extension's side of the protocol: `trek serve` as a child process, started in `cwd`. */
export class TrekClient {
  private readonly proc: ChildProcess
  private readonly connection: MessageConnection

  constructor(command: readonly string[], cwd: string) {
    const [program, ...args] = command
    if (program === undefined) {
      throw new Error("no command to start trek serve")
    }
    this.proc = spawn(program, args, { cwd, stdio: ["pipe", "pipe", "inherit"] })

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

  initialize(): Promise<unknown> {
    return this.connection.sendRequest("initialize", {
      protocol_version: PROTOCOL_VERSION,
      client: CLIENT,
    })
  }

  tours(): Promise<ToursResult> {
    return this.connection.sendRequest("tours")
  }

  open(tour: string): Promise<SessionView> {
    return this.connection.sendRequest("open", { tour })
  }

  move(move: Move, params?: object): Promise<SessionView> {
    return params === undefined
      ? this.connection.sendRequest(move)
      : this.connection.sendRequest(move, params)
  }

  close(): void {
    this.connection.dispose()
    this.proc.kill()
  }
}
