import {
  ResponseError,
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection,
} from "vscode-jsonrpc/node"
import { answerRequest, newServeState } from "./requests"

/**
 * `trail serve`: the editor protocol over stdin and stdout, for one editor stepping through
 * tours saved in `cwd`. Resolves once the editor closes stdin.
 */
export function startServe(cwd: string): Promise<void> {
  const connection = createMessageConnection(
    new StreamMessageReader(process.stdin),
    new StreamMessageWriter(process.stdout),
  )
  let state = newServeState(cwd)
  // The connection runs async handlers side by side; each request must see the state the one
  // before it left, so they're chained.
  let previous: Promise<unknown> = Promise.resolve()

  connection.onRequest((method: string, params: unknown) => {
    const answered = previous.then(async () => {
      const { state: next, answer } = await answerRequest(state, method, params)
      state = next
      if ("error" in answer) {
        throw new ResponseError(answer.error.code, answer.error.message)
      }

      return answer.result
    })
    previous = answered.catch(() => undefined)

    return answered
  })

  const closed = new Promise<void>((resolve) => connection.onClose(resolve))
  connection.listen()

  return closed
}
