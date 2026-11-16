import {
  ErrorCode,
  type InitializeResult,
  type Method,
  PROTOCOL_VERSION,
  InvalidParams,
  parseParams,
  type SteppingSession,
  SRCTREK_VERSION,
  isMethod,
  sessionView,
  stepBack,
  stepInto,
  stepNext,
  stepOut,
  stepOver,
  stepTo,
  versionMismatch,
} from "@srctrek/core"
import { buildTrek, logOf, treksIn } from "./change"
import { RequestError } from "./errors"
import { type OpenTrek, openTrek } from "./open"

/** What trek serve holds between requests. */
export type ServeState = {
  readonly cwd: string
  readonly initialized: boolean
  readonly open: OpenTrek | undefined
}

/** A request's answer: its result, or why it failed. */
export type Answer =
  Readonly<{ result: unknown }> | Readonly<{ error: Readonly<{ code: number; message: string }> }>

// JSON-RPC's own codes.
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

type Moved = Readonly<{ state: ServeState; result: unknown }>

export function newServeState(cwd: string): ServeState {
  return { cwd, initialized: false, open: undefined }
}

function initialize(state: ServeState, clientVersion: number): Moved {
  if (clientVersion !== PROTOCOL_VERSION) {
    throw new RequestError(ErrorCode.versionMismatch, versionMismatch(clientVersion))
  }

  const result: InitializeResult = {
    protocol_version: PROTOCOL_VERSION,
    srctrek_version: SRCTREK_VERSION,
  }

  return { state: { ...state, initialized: true }, result }
}

// The state with the open trek moved to `session`, and its view as the answer.
function moved(open: OpenTrek, state: ServeState, session: SteppingSession): Moved {
  return {
    state: { ...state, open: { ...open, session } },
    result: sessionView(session, open.context),
  }
}

// The step `goto` names, which must be one of the trek's.
function gotoStep(session: SteppingSession, step: string): SteppingSession {
  if (!session.trek.steps.some((s) => s.id === step)) {
    throw new RequestError(ErrorCode.unknownStep, `the trek has no step ${step}`)
  }

  return stepTo(session, step)
}

type AboutChange = "treks" | "build" | "log"
type Move = Exclude<Method, "initialize" | "open" | AboutChange>
type Step = (session: SteppingSession) => SteppingSession

// A move that takes no params, which are still checked to be none.
const withoutParams = (method: Move, step: Step) => (params: unknown) => {
  parseParams(method, params)
  return step
}

// Each move, from the request's params, read before anything else is checked, to the step it
// makes on the open session.
const MOVES: Record<Move, (params: unknown) => Step> = {
  next: withoutParams("next", stepNext),
  prev: withoutParams("prev", stepBack),
  over: withoutParams("over", stepOver),
  out: withoutParams("out", stepOut),
  into: (params) => {
    const target = parseParams("into", params)?.target
    return (session) => stepInto(session, target)
  },
  goto: (params) => {
    const { step } = parseParams("goto", params)
    return (session) => gotoStep(session, step)
  },
}

function requireInitialized(state: ServeState): void {
  if (!state.initialized) {
    throw new RequestError(ErrorCode.notInitialized, "send initialize first")
  }
}

function move(state: ServeState, method: Move, params: unknown): Moved {
  const step = MOVES[method](params)
  requireInitialized(state)
  const open = state.open
  if (open === undefined) {
    throw new RequestError(ErrorCode.noTrek, "no trek is open: send open first")
  }

  return moved(open, state, step(open.session))
}

// Requests about the change and its saved treks, from the request's params, read first; they
// leave the session as it is.
const ABOUT_CHANGE: Record<AboutChange, (params: unknown) => (cwd: string) => Promise<unknown>> = {
  treks: (params) => {
    const args = parseParams("treks", params)?.args ?? []
    return (cwd) => treksIn(cwd, args)
  },
  build: (params) => {
    const args = parseParams("build", params)?.args ?? []
    return (cwd) => buildTrek(cwd, args)
  },
  log: (params) => {
    const { trek, lines } = parseParams("log", params)
    return (cwd) => logOf(cwd, trek, lines)
  },
}

function isAboutChange(method: Method): method is AboutChange {
  return Object.hasOwn(ABOUT_CHANGE, method)
}

async function openRequest(state: ServeState, params: unknown): Promise<Moved> {
  const { trek, args } = parseParams("open", params)
  requireInitialized(state)
  const open = await openTrek(state.cwd, trek, args)

  return { state: { ...state, open }, result: sessionView(open.session, open.context) }
}

// Each request reads its params before checking the session, so params that don't fit are the
// first thing a client hears about.
async function carryOut(state: ServeState, method: Method, params: unknown): Promise<Moved> {
  if (method === "initialize") {
    return initialize(state, parseParams("initialize", params).protocol_version)
  }

  if (method === "open") {
    return openRequest(state, params)
  }

  if (isAboutChange(method)) {
    const run = ABOUT_CHANGE[method](params)
    requireInitialized(state)
    return { state, result: await run(state.cwd) }
  }

  return move(state, method, params)
}

/** The answer to one request, and the state after it; a failed request leaves the state as it was. */
export async function answerRequest(
  state: ServeState,
  method: string,
  params: unknown,
): Promise<{ state: ServeState; answer: Answer }> {
  if (!isMethod(method)) {
    return { state, answer: { error: { code: METHOD_NOT_FOUND, message: `no method ${method}` } } }
  }

  try {
    const { state: next, result } = await carryOut(state, method, params)
    return { state: next, answer: { result } }
  } catch (error) {
    if (error instanceof RequestError) {
      return { state, answer: { error: { code: error.code, message: error.message } } }
    }

    // each request's params are checked as it's carried out
    if (error instanceof InvalidParams) {
      return { state, answer: { error: { code: INVALID_PARAMS, message: error.message } } }
    }

    throw error
  }
}
