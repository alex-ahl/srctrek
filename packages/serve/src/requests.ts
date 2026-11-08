import {
  ErrorCode,
  type InitializeResult,
  type Method,
  PROTOCOL_VERSION,
  RequestParams,
  type SteppingSession,
  TRAIL_VERSION,
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
import { buildTour, logOf, toursIn } from "./change"
import { RequestError } from "./errors"
import { type OpenTour, openTour } from "./open"

/** What trek serve holds between requests. */
export type ServeState = {
  readonly cwd: string
  readonly initialized: boolean
  readonly open: OpenTour | undefined
}

/** A request's answer: its result, or why it failed. */
export type Answer = { result: unknown } | { error: { code: number; message: string } }

// JSON-RPC's own codes.
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

type Moved = { state: ServeState; result: unknown }

export function newServeState(cwd: string): ServeState {
  return { cwd, initialized: false, open: undefined }
}

function initialize(state: ServeState, clientVersion: number): Moved {
  if (clientVersion !== PROTOCOL_VERSION) {
    throw new RequestError(ErrorCode.versionMismatch, versionMismatch(clientVersion))
  }

  const result: InitializeResult = {
    protocol_version: PROTOCOL_VERSION,
    trail_version: TRAIL_VERSION,
  }

  return { state: { ...state, initialized: true }, result }
}

// The state with the open tour moved to `session`, and its view as the answer.
function moved(open: OpenTour, state: ServeState, session: SteppingSession): Moved {
  return {
    state: { ...state, open: { ...open, session } },
    result: sessionView(session, open.context),
  }
}

// The step `goto` names, which must be one of the tour's.
function gotoStep(session: SteppingSession, params: unknown): SteppingSession {
  const { step } = RequestParams.goto.parse(params)
  if (!session.tour.steps.some((s) => s.id === step)) {
    throw new RequestError(ErrorCode.unknownStep, `the tour has no step ${step}`)
  }

  return stepTo(session, step)
}

type AboutChange = "tours" | "build" | "log"
type Move = Exclude<Method, "initialize" | "open" | AboutChange>

// Each move, from the session and the request's params, already checked.
const MOVES: Record<Move, (session: SteppingSession, params: unknown) => SteppingSession> = {
  next: stepNext,
  prev: stepBack,
  into: (session, params) => stepInto(session, RequestParams.into.parse(params)?.target),
  over: stepOver,
  out: stepOut,
  goto: gotoStep,
}

function move(state: ServeState, method: Move, params: unknown): Moved {
  const open = state.open
  if (open === undefined) {
    throw new RequestError(ErrorCode.noTour, "no tour is open: send open first")
  }

  return moved(open, state, MOVES[method](open.session, params))
}

// Requests about the change and its saved tours, from the params already checked; they leave
// the session as it is.
const ABOUT_CHANGE: Record<AboutChange, (cwd: string, params: unknown) => Promise<unknown>> = {
  tours: (cwd, params) => toursIn(cwd, RequestParams.tours.parse(params)?.args ?? []),
  build: (cwd, params) => buildTour(cwd, RequestParams.build.parse(params)?.args ?? []),
  log: (cwd, params) => {
    const { tour, lines } = RequestParams.log.parse(params)
    return logOf(cwd, tour, lines)
  },
}

function isAboutChange(method: Method): method is AboutChange {
  return Object.hasOwn(ABOUT_CHANGE, method)
}

async function carryOut(state: ServeState, method: Method, params: unknown): Promise<Moved> {
  if (method === "initialize") {
    return initialize(state, RequestParams.initialize.parse(params).protocol_version)
  }

  if (!state.initialized) {
    throw new RequestError(ErrorCode.notInitialized, "send initialize first")
  }

  if (method === "open") {
    const { tour, args } = RequestParams.open.parse(params)
    const open = await openTour(state.cwd, tour, args)
    return { state: { ...state, open }, result: sessionView(open.session, open.context) }
  }

  if (isAboutChange(method)) {
    return { state, result: await ABOUT_CHANGE[method](state.cwd, params) }
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

  const checked = RequestParams[method].safeParse(params)
  if (!checked.success) {
    const message = `invalid params for ${method}: ${checked.error.message}`
    return { state, answer: { error: { code: INVALID_PARAMS, message } } }
  }

  try {
    const { state: next, result } = await carryOut(state, method, params)
    return { state: next, answer: { result } }
  } catch (error) {
    if (error instanceof RequestError) {
      return { state, answer: { error: { code: error.code, message: error.message } } }
    }

    throw error
  }
}
