import type { ChangeSummary, HomeFocus, TrekStatus } from "@srctrek/core"

/**
 * The code as it is over the change's repos: where finding its ways in stands, and, with an agent
 * set, finding them and building the trek of one.
 */
export type OpenCode = {
  status: () => Promise<TrekStatus>
  // the way in trek's args asked for by name, with --code="…", and where its trek stands
  asked?: { name: string; status: () => Promise<TrekStatus> } | undefined
  find?: (() => Promise<void>) | undefined
  buildTrigger?: ((trigger: string) => Promise<void>) | undefined
}

/**
 * A change opened by trek's args or a pick: the change, the code as it is beside it, and which was
 * asked for.
 */
export type OpenChange = {
  // what the change is, for the title bar
  summary: ChangeSummary
  status: () => Promise<TrekStatus>
  // starts building the change's trek; absent when no agent is set
  build?: (() => Promise<void>) | undefined
  code: OpenCode
  focus: HomeFocus
}
