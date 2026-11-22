import type { ChangeSummary, TrekStatus } from "@srctrek/core"

/**
 * A change opened from trek's args or the landing page: what it is, where its trek stands, and,
 * with an agent set, building it. For code as it is with no trigger, building it finds its ways
 * in, and each way in's trek is built by its trigger.
 */
export type OpenChange = {
  summary: ChangeSummary
  status: () => Promise<TrekStatus>
  build?: (() => Promise<void>) | undefined
  buildTrigger?: ((trigger: string) => Promise<void>) | undefined
}
