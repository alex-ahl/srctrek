import {
  ErrorCode,
  type SteppingSession,
  TrekValidationError,
  UnreachableRepoError,
  type ViewContext,
  loadTrek,
  openSession,
  trekPath,
  viewContext,
} from "@srctrek/core"
import { existsSync } from "node:fs"
import { changeNow } from "./change"
import { RequestError } from "./errors"

/** A trek open for stepping: its session, and what its view needs from git. */
export type OpenTrek = Readonly<{ session: SteppingSession; context: ViewContext }>

async function loadNamed(cwd: string, name: string) {
  const path = trekPath(cwd, name)
  if (!existsSync(path)) {
    throw new RequestError(ErrorCode.noTrek, `no trek named ${name} in ${cwd}`)
  }

  try {
    return await loadTrek(path)
  } catch (error) {
    if (error instanceof TrekValidationError) {
      throw new RequestError(ErrorCode.invalidTrek, error.message)
    }

    throw error
  }
}

/**
 * The trek saved under `name` in `cwd`, open at its overview; with trek's `args`, the change
 * as it is now marks the steps whose file has moved on.
 */
export async function openTrek(cwd: string, name: string, args?: string[]): Promise<OpenTrek> {
  const trek = await loadNamed(cwd, name)
  const change = args === undefined ? undefined : await changeNow(cwd, args)

  try {
    const context = await viewContext(cwd, trek, change === undefined ? {} : { change })
    return { session: openSession(trek), context }
  } catch (error) {
    if (error instanceof UnreachableRepoError) {
      throw new RequestError(ErrorCode.unreachableRepo, error.message)
    }

    throw error
  }
}
