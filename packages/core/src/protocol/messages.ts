import { z } from "zod"
import type { TrekStatus } from "../build/status"
import type { TrekEntry } from "../trek-entries"

/** The editor protocol's version; client and core must agree on it. */
export const PROTOCOL_VERSION = 1

// Pre-release: there are no version numbers yet.
export const SRCTREK_VERSION = "0.0.0"

const nonEmpty = z.string().min(1)
const none = z.object({}).strict().optional()
// trek's arguments for the change as it is now; none means the current branch's change
const change = z
  .object({ args: z.array(z.string()).optional() })
  .strict()
  .optional()

/**
 * Each request a client can send, by method, with the params core accepts. The moves and
 * `open` answer with the session's view; the rest with their own results below.
 */
export const RequestParams = {
  initialize: z.object({
    protocol_version: z.number().int(),
    client: z.object({ name: nonEmpty, version: nonEmpty }),
  }),
  // a trek saved in the folder trek serve runs in, by name; with trek's arguments for the
  // change as it is now, steps whose file has moved on are marked stale
  open: z.object({ trek: nonEmpty, args: z.array(z.string()).optional() }),
  next: none,
  prev: none,
  into: z.object({ target: nonEmpty.optional() }).strict().optional(),
  over: none,
  out: none,
  goto: z.object({ step: nonEmpty }),
  // the saved treks, and where the change's trek stands
  treks: change,
  // builds the change's trek, or updates it when it's stale
  build: change,
  // the last lines of a trek's build log
  log: z.object({ trek: nonEmpty, lines: z.number().int().positive().optional() }),
}

export type Method = keyof typeof RequestParams

export type InitializeResult = { protocol_version: number; srctrek_version: string }

/** What `treks` answers: every saved trek, and the change's trek as it stands. */
export type TreksResult = { change: TrekStatus; treks: TrekEntry[] }

/** What `build` answers: the change's trek as it stands once the build has started. */
export type BuildResult = { change: TrekStatus }

/** What `log` answers: the end of a build's log, oldest line first. */
export type LogResult = { lines: string[] }

/** Error codes core answers with, beside JSON-RPC's own. */
export const ErrorCode = {
  versionMismatch: 1,
  notInitialized: 2,
  noTrek: 3,
  invalidTrek: 4,
  unreachableRepo: 5,
  unknownStep: 6,
  noAgent: 7,
  unreadableChange: 8,
} as const

/** Whether `method` names a request the protocol has. */
export function isMethod(method: string): method is Method {
  return Object.hasOwn(RequestParams, method)
}

/** What to tell the user when a client speaks another protocol version: which side to update. */
export function versionMismatch(clientVersion: number): string {
  const older = clientVersion < PROTOCOL_VERSION ? "the editor plugin" : "trek"

  return `the editor plugin speaks protocol ${clientVersion}, trek speaks ${PROTOCOL_VERSION}: update ${older}`
}
