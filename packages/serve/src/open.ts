import {
  ErrorCode,
  type SteppingSession,
  TourValidationError,
  UnreachableRepoError,
  type ViewContext,
  loadTour,
  openSession,
  tourPath,
  viewContext,
} from "@srctrek/core"
import { existsSync } from "node:fs"
import { changeNow } from "./change"
import { RequestError } from "./errors"

/** A tour open for stepping: its session, and what its view needs from git. */
export type OpenTour = { session: SteppingSession; context: ViewContext }

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
 * The tour saved under `name` in `cwd`, open at its overview; with trek's `args`, the change
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
