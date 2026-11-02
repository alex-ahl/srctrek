import { z } from "zod"

/** The editor protocol's version; client and core must agree on it. */
export const PROTOCOL_VERSION = 1

// Pre-release: there are no version numbers yet.
export const TRAIL_VERSION = "0.0.0"

const nonEmpty = z.string().min(1)
const none = z.object({}).strict().optional()

/**
 * Each request a client can send, by method, with the params core accepts. Every request but
 * `initialize` answers with the session's view; `initialize` answers with InitializeResult.
 */
export const RequestParams = {
  initialize: z.object({
    protocol_version: z.number().int(),
    client: z.object({ name: nonEmpty, version: nonEmpty }),
  }),
  // a tour saved in the folder trail serve runs in, by name; with trail's arguments for the
  // change as it is now, steps whose file has moved on are marked stale
  open: z.object({ tour: nonEmpty, args: z.array(z.string()).optional() }),
  next: none,
  prev: none,
  into: z.object({ target: nonEmpty.optional() }).strict().optional(),
  over: none,
  out: none,
  goto: z.object({ step: nonEmpty }),
}

export type Method = keyof typeof RequestParams

export type InitializeResult = { protocol_version: number; trail_version: string }

/** Error codes core answers with, beside JSON-RPC's own. */
export const ErrorCode = {
  versionMismatch: 1,
  notInitialized: 2,
  noTour: 3,
  invalidTour: 4,
  unreachableRepo: 5,
  unknownStep: 6,
} as const

/** Whether `method` names a request the protocol has. */
export function isMethod(method: string): method is Method {
  return Object.hasOwn(RequestParams, method)
}

/** What to tell the user when a client speaks another protocol version: which side to update. */
export function versionMismatch(clientVersion: number): string {
  const older = clientVersion < PROTOCOL_VERSION ? "the editor plugin" : "trail"

  return `the editor plugin speaks protocol ${clientVersion}, trail speaks ${PROTOCOL_VERSION}: update ${older}`
}
