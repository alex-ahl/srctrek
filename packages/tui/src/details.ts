import type { ChangeChoice, PullRequestDetails } from "@srctrek/core"
import { useEffect, useState } from "react"
import type { Sources } from "./sources"

/**
 * The pull request a choice opens, by its title, who opened it, and whether it's a draft, once gh
 * says; none for any other change, or when gh can't say, the screen then naming it by its number.
 */
export function usePullRequestDetails(
  choice: ChangeChoice | undefined,
  sources: Sources,
): PullRequestDetails | undefined {
  const url = choice?.kind === "pull-request" ? choice.url : undefined
  const [read, setRead] = useState<{ url: string; details: PullRequestDetails }>()

  useEffect(() => {
    if (url === undefined) {
      return undefined
    }

    let current = true
    sources.pullRequest(url).then(
      (details) => current && setRead({ url, details }),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [url, sources])

  return read?.url === url ? read?.details : undefined
}
