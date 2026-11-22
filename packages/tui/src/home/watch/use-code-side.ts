import type { TrekStatus } from "@srctrek/core"
import { useState } from "react"
import type { AskedWayIn } from "../list/rows"
import type { OpenCode } from "../../change/open-change"
import { useBuildWatch } from "./use-build-watch"

/**
 * Where the code as it is beside the change stands: its ways in, and the way in trek's args asked
 * for, each watched while it builds; `read` reads both afresh, for `code` as it is now.
 */
export function useCodeSide(
  code: OpenCode | undefined,
  first: Readonly<{ status: TrekStatus | undefined; asked: TrekStatus | undefined }>,
  ended: () => Promise<void>,
) {
  const [status, setStatus] = useState(first.status)
  const [askedStatus, setAskedStatus] = useState(first.asked)
  useBuildWatch(status, code?.status, { status: setStatus, ended })
  useBuildWatch(askedStatus, code?.asked?.status, { status: setAskedStatus, ended })

  const read = async (now: OpenCode | undefined) => {
    setStatus(await now?.status())
    setAskedStatus(await now?.asked?.status())
  }
  const name = code?.asked?.name
  const asked: AskedWayIn | undefined =
    name === undefined || askedStatus === undefined ? undefined : { name, trek: askedStatus }

  return { status, asked, read }
}
