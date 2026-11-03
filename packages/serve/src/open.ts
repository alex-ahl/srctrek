import {
  ErrorCode,
  type ResolvedChange,
  type SteppingSession,
  TourValidationError,
  UnreachableRepoError,
  type ViewContext,
  directoryIn,
  loadTour,
  openSession,
  readChangeArguments,
  resolveChange,
  tourPath,
  viewContext,
} from "@codetrail/core"
import { existsSync } from "node:fs"

/** A request core can't carry out, with the protocol's code for why. */
export class RequestError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
  }
}

/** A tour open for stepping: its session, and what its view needs from git. */
export type OpenTour = { session: SteppingSession; context: ViewContext }

async function changeNow(cwd: string, args: string[]): Promise<ResolvedChange> {
  try {
    return await resolveChange(cwd, readChangeArguments(args, directoryIn(cwd)))
  } catch (error) {
    throw new RequestError(ErrorCode.noTour, `can't read the change: ${String(error)}`)
  }
}

async function loadNamed(cwd: string, name: string) {
  const path = tourPath(cwd, name)
  if (!existsSync(path)) {
    throw new RequestError(ErrorCode.noTour, `no tour named ${name} in ${cwd}`)
  }

  try {
    return await loadTour(path)
  } catch (error) {
    if (error instanceof TourValidationError) {
      throw new RequestError(ErrorCode.invalidTour, error.message)
    }

    throw error
  }
}

/**
 * The tour saved under `name` in `cwd`, open at its overview; with trail's `args`, the change
 * as it is now marks the steps whose file has moved on.
 */
export async function openTour(cwd: string, name: string, args?: string[]): Promise<OpenTour> {
  const tour = await loadNamed(cwd, name)
  const change = args === undefined ? undefined : await changeNow(cwd, args)

  try {
    const context = await viewContext(cwd, tour, change === undefined ? {} : { change })
    return { session: openSession(tour), context }
  } catch (error) {
    if (error instanceof UnreachableRepoError) {
      throw new RequestError(ErrorCode.unreachableRepo, error.message)
    }

    throw error
  }
}
